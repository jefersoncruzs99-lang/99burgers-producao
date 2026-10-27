/**
 * Monta os arquivos que vão para a impressora, sem depender do navegador (testável).
 * Etiqueta 60 x 50 mm a 203 dpi = 480 x 400 pontos.
 */

export const LARGURA_PONTOS = 480;
export const ALTURA_PONTOS = 400;
const MM_EM_PT = 72 / 25.4;

function bytes(s: string): Uint8Array {
  // Só ASCII nas partes de texto do PDF/TSPL.
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function juntar(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/**
 * PDF com N páginas de 60 x 50 mm, todas com a mesma imagem JPEG (uma etiqueta por página).
 * O RawBT imprime PDF direto na impressora de etiquetas.
 */
export function pdfEtiquetas(
  jpeg: Uint8Array,
  largImg: number,
  altImg: number,
  copias: number,
  larguraMm = 60,
  alturaMm = 50,
): Uint8Array {
  const n = Math.max(1, Math.min(50, Math.floor(copias)));
  const w = (larguraMm * MM_EM_PT).toFixed(2);
  const h = (alturaMm * MM_EM_PT).toFixed(2);

  // Objetos: 1 catálogo, 2 páginas, 3 imagem, 4 conteúdo, depois uma página por cópia.
  const conteudo = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  const objetos: Uint8Array[] = [];
  const kids = Array.from({ length: n }, (_, i) => `${5 + i} 0 R`).join(" ");
  objetos.push(bytes(`<< /Type /Catalog /Pages 2 0 R >>`));
  objetos.push(bytes(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
  objetos.push(
    juntar([
      bytes(
        `<< /Type /XObject /Subtype /Image /Width ${largImg} /Height ${altImg} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      ),
      jpeg,
      bytes(`\nendstream`),
    ]),
  );
  objetos.push(bytes(`<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`));
  for (let i = 0; i < n; i++) {
    objetos.push(
      bytes(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 3 0 R >> >> /Contents 4 0 R >>`,
      ),
    );
  }

  const partes: Uint8Array[] = [bytes("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets: number[] = [];
  let pos = partes[0]!.length;
  objetos.forEach((obj, i) => {
    offsets.push(pos);
    const cab = bytes(`${i + 1} 0 obj\n`);
    const fim = bytes(`\nendobj\n`);
    partes.push(cab, obj, fim);
    pos += cab.length + obj.length + fim.length;
  });
  const xref =
    `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  partes.push(bytes(xref));
  return juntar(partes);
}

/**
 * Converte pixels RGBA em bitmap 1 bit (linha a linha, 8 pontos por byte).
 * No TSPL o bit 0 imprime (preto) e o bit 1 fica em branco.
 */
export function bitmap1Bit(rgba: Uint8ClampedArray | Uint8Array, largura: number, altura: number, limiar = 160): Uint8Array {
  const porLinha = Math.ceil(largura / 8);
  const out = new Uint8Array(porLinha * altura).fill(0xff);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = (y * largura + x) * 4;
      const lum = 0.299 * (rgba[i] ?? 255) + 0.587 * (rgba[i + 1] ?? 255) + 0.114 * (rgba[i + 2] ?? 255);
      const alfa = rgba[i + 3] ?? 255;
      const preto = alfa > 127 && lum < limiar;
      if (preto) {
        const b = y * porLinha + (x >> 3);
        out[b] = (out[b] ?? 0xff) & ~(0x80 >> (x & 7));
      }
    }
  }
  return out;
}

/** Comandos TSPL: tamanho da etiqueta, imagem e quantidade de cópias. */
export function tsplEtiquetas(mono: Uint8Array, largura: number, altura: number, copias: number, larguraMm = 60, alturaMm = 50): Uint8Array {
  const n = Math.max(1, Math.min(50, Math.floor(copias)));
  const porLinha = Math.ceil(largura / 8);
  return juntar([
    bytes(
      `SIZE ${larguraMm} mm,${alturaMm} mm\r\nGAP 2 mm,0 mm\r\nDIRECTION 1\r\nREFERENCE 0,0\r\nDENSITY 10\r\nCLS\r\nBITMAP 0,0,${porLinha},${altura},0,`,
    ),
    mono,
    bytes(`\r\nPRINT 1,${n}\r\n`),
  ]);
}

export function paraBase64(dados: Uint8Array): string {
  let s = "";
  const bloco = 0x8000;
  for (let i = 0; i < dados.length; i += bloco) {
    s += String.fromCharCode(...dados.subarray(i, i + bloco));
  }
  return btoa(s);
}

export function deBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
