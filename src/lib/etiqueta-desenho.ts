import { create as criarQr } from "qrcode";
import { camposEtiqueta } from "./etiqueta";
import {
  ALTURA_PONTOS,
  LARGURA_PONTOS,
  bitmap1Bit,
  deBase64,
  paraBase64,
  pdfEtiquetas,
  tsplEtiquetas,
} from "./etiqueta-arquivos";
import type { EtiquetaEmitida } from "./tipos";

const FONTE = 'Roboto, "Helvetica Neue", Arial, sans-serif';
const M = 16; // margem

let logoPromessa: Promise<HTMLImageElement | null> | null = null;
function carregarLogo(): Promise<HTMLImageElement | null> {
  if (!logoPromessa) {
    logoPromessa = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = "/logo-etiqueta.png";
    });
  }
  return logoPromessa;
}

/** Escreve o texto diminuindo a fonte até caber na largura. */
function textoAjustado(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  larguraMax: number,
  peso: number,
  tamanho: number,
  minimo = 11,
  alinhar: CanvasTextAlign = "left",
) {
  let t = tamanho;
  ctx.font = `${peso} ${t}px ${FONTE}`;
  while (ctx.measureText(texto).width > larguraMax && t > minimo) {
    t -= 1;
    ctx.font = `${peso} ${t}px ${FONTE}`;
  }
  ctx.textAlign = alinhar;
  ctx.fillText(texto, x, y, larguraMax);
  ctx.textAlign = "left";
}

/** Quebra o nome do produto em até 2 linhas, diminuindo a fonte se precisar. */
function nomeEmLinhas(ctx: CanvasRenderingContext2D, nome: string, larguraMax: number, tamanho: number) {
  for (let t = tamanho; t >= 16; t--) {
    ctx.font = `900 ${t}px ${FONTE}`;
    if (ctx.measureText(nome).width <= larguraMax) return { linhas: [nome], tamanho: t };
    const palavras = nome.split(" ");
    for (let i = palavras.length - 1; i > 0; i--) {
      const a = palavras.slice(0, i).join(" ");
      const b = palavras.slice(i).join(" ");
      if (ctx.measureText(a).width <= larguraMax && ctx.measureText(b).width <= larguraMax) {
        return { linhas: [a, b], tamanho: Math.min(t, tamanho - 4) };
      }
    }
  }
  return { linhas: [nome], tamanho: 16 };
}

/** Desenha a etiqueta (modelo A) em um canvas de 480 x 400 pontos, só preto e branco. */
export async function desenharEtiqueta(e: EtiquetaEmitida, origem: string): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = LARGURA_PONTOS;
  c.height = ALTURA_PONTOS;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Não foi possível desenhar a etiqueta neste aparelho.");
  const f = camposEtiqueta(e);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";

  // Cabeçalho: logo + nome do produto
  const logo = await carregarLogo();
  if (logo) ctx.drawImage(logo, M, 12, 74, 74);
  const xNome = M + 86;
  const largNome = LARGURA_PONTOS - xNome - M;
  const { linhas, tamanho } = nomeEmLinhas(ctx, f.nome, largNome, 30);
  ctx.font = `900 ${tamanho}px ${FONTE}`;
  let y = 12 + tamanho;
  for (const l of linhas) {
    ctx.fillText(l, xNome, y);
    y += tamanho + 2;
  }
  // Linha de baixo do cabeçalho: [ABERTO] + empresa · setor
  const ySub = Math.min(Math.max(y + 4, 72), 88);
  let xSub = xNome;
  if (f.tag) {
    ctx.font = `900 14px ${FONTE}`;
    const w = ctx.measureText(f.tag).width + 12;
    ctx.fillRect(xSub, ySub - 15, w, 20);
    ctx.fillStyle = "#fff";
    ctx.fillText(f.tag, xSub + 6, ySub);
    ctx.fillStyle = "#000";
    xSub += w + 8;
  }
  textoAjustado(ctx, f.subtitulo, xSub, ySub, LARGURA_PONTOS - xSub - M, 700, 14, 9);

  // Linha divisória
  ctx.fillRect(M, 94, LARGURA_PONTOS - 2 * M, 4);

  // Campos
  const tamQr = 86;
  const xQr = LARGURA_PONTOS - M - tamQr;
  const xValor = M + 142;
  let yl = 126;
  const passo = f.linhas.length > 5 ? 26 : 29;
  for (const linha of f.linhas) {
    textoAjustado(ctx, linha.rotulo, M, yl, 136, 500, 19);
    textoAjustado(ctx, linha.valor, xValor, yl, xQr - xValor - 8, 800, 19);
    yl += passo;
  }

  // QR com o lote (abre a consulta da etiqueta)
  try {
    const qr = criarQr(`${origem}/etiqueta/${e.lote}`, { errorCorrectionLevel: "L" });
    const n = qr.modules.size;
    const modulo = Math.floor(tamQr / n);
    const desloc = Math.floor((tamQr - modulo * n) / 2);
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        if (qr.modules.get(r, col)) ctx.fillRect(xQr + desloc + col * modulo, 106 + desloc + r * modulo, modulo, modulo);
      }
    }
  } catch {
    // sem QR: o resto da etiqueta continua valendo
  }

  // Faixa VENCE
  const yFaixa = 296;
  ctx.fillRect(0, yFaixa, LARGURA_PONTOS, 58);
  ctx.fillStyle = "#fff";
  ctx.font = `800 18px ${FONTE}`;
  ctx.fillText("VENCE", M, yFaixa + 36);
  textoAjustado(ctx, f.venceDia, LARGURA_PONTOS / 2 + 10, yFaixa + 43, 270, 900, 38, 20, "center");
  ctx.font = `800 18px ${FONTE}`;
  ctx.textAlign = "right";
  ctx.fillText(f.venceHora, LARGURA_PONTOS - M, yFaixa + 36);
  ctx.textAlign = "left";
  ctx.fillStyle = "#000";

  // Rodapé
  textoAjustado(ctx, f.lote, M, 386, 200, 700, 15);
  textoAjustado(ctx, f.cnpj, LARGURA_PONTOS - M, 386, 240, 700, 15, 10, "right");

  // Preto e branco puro (térmica não imprime cinza)
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 0.299 * (d[i] ?? 255) + 0.587 * (d[i + 1] ?? 255) + 0.114 * (d[i + 2] ?? 255) < 150 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export type ModoImpressao = "rawbt-pdf" | "rawbt-tspl" | "navegador";

export const MODOS_IMPRESSAO: { valor: ModoImpressao; rotulo: string; ajuda: string }[] = [
  { valor: "rawbt-pdf", rotulo: "RawBT (recomendado)", ajuda: "Envia para o app RawBT, que imprime na Knup pelo Bluetooth." },
  { valor: "rawbt-tspl", rotulo: "RawBT modo direto (TSPL)", ajuda: "Use se o modo recomendado sair cortado ou fora de posição." },
  { valor: "navegador", rotulo: "Impressão do Android", ajuda: "Abre a tela de impressão do Chrome." },
];

const CHAVE_MODO = "prod_etiqueta_modo";

export function lerModo(): ModoImpressao {
  try {
    const v = localStorage.getItem(CHAVE_MODO);
    if (v === "rawbt-pdf" || v === "rawbt-tspl" || v === "navegador") return v;
  } catch {
    // sem armazenamento: usa o padrão
  }
  return "rawbt-pdf";
}

export function salvarModo(m: ModoImpressao) {
  try {
    localStorage.setItem(CHAVE_MODO, m);
  } catch {
    // ignora
  }
}

/** Envia as etiquetas para a impressora. Retorna a imagem (para a prévia). */
export async function imprimirEtiqueta(e: EtiquetaEmitida, copias: number, modo: ModoImpressao): Promise<string> {
  const canvas = await desenharEtiqueta(e, window.location.origin);
  const png = canvas.toDataURL("image/png");

  if (modo === "rawbt-pdf") {
    const jpeg = deBase64(canvas.toDataURL("image/jpeg", 0.95).split(",")[1] ?? "");
    const pdf = pdfEtiquetas(jpeg, canvas.width, canvas.height, copias);
    window.location.href = `rawbt:data:application/pdf;base64,${paraBase64(pdf)}`;
  } else if (modo === "rawbt-tspl") {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a etiqueta.");
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const tspl = tsplEtiquetas(bitmap1Bit(px, canvas.width, canvas.height), canvas.width, canvas.height, copias);
    window.location.href = `rawbt:base64,${paraBase64(tspl)}`;
  } else {
    imprimirPeloNavegador(png, copias);
  }
  return png;
}

function imprimirPeloNavegador(png: string, copias: number) {
  const id = "area-impressao-etiquetas";
  document.getElementById(id)?.remove();
  const area = document.createElement("div");
  area.id = id;
  area.className = "so-impressao";
  for (let i = 0; i < Math.max(1, copias); i++) {
    const img = document.createElement("img");
    img.src = png;
    img.alt = "";
    area.appendChild(img);
  }
  document.body.appendChild(area);
  const imgs = Array.from(area.querySelectorAll("img"));
  Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => (i.onload = r))))).then(() => {
    window.print();
  });
}
