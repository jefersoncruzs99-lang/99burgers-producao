import { create as criarQr } from "qrcode";
import { camposEtiqueta } from "./etiqueta";
import {
  LARGURA_PONTOS,
  TAMANHOS,
  type TamanhoEtiqueta,
  bitmap1Bit,
  deBase64,
  dividirEnvios,
  paraBase64,
  pdfVarias,
  tsplVarias,
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

/** Medidas do desenho para cada tamanho de etiqueta (em pontos, 8 por mm). */
const LAYOUT = {
  "60x50": {
    logo: { y: 12, tam: 74 }, nomeX: 86, nomeFonte: 30, sub: { min: 72, max: 88, fonte: 14 }, divisoria: 94,
    qr: { tam: 86, y: 106 }, valorX: 142, rotuloLarg: 136, campos: { y: 126, passo: 29, passoApertado: 26, fonte: 19 },
    faixa: { y: 296, alt: 58, textoY: 36, diaY: 43, texto: 18, dia: 38 }, rodape: { y: 386, fonte: 15 },
  },
  "60x40": {
    logo: { y: 8, tam: 58 }, nomeX: 68, nomeFonte: 26, sub: { min: 56, max: 68, fonte: 12 }, divisoria: 74,
    qr: { tam: 72, y: 84 }, valorX: 118, rotuloLarg: 112, campos: { y: 100, passo: 25, passoApertado: 21, fonte: 16 },
    faixa: { y: 232, alt: 50, textoY: 31, diaY: 37, texto: 15, dia: 32 }, rodape: { y: 308, fonte: 12 },
  },
} as const;

/** Desenha a etiqueta (modelo A) no tamanho escolhido, só preto e branco. */
export async function desenharEtiqueta(e: EtiquetaEmitida, origem: string, tamanho: TamanhoEtiqueta = "60x50"): Promise<HTMLCanvasElement> {
  const L = LAYOUT[tamanho];
  const c = document.createElement("canvas");
  c.width = LARGURA_PONTOS;
  c.height = TAMANHOS[tamanho].altura;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Não foi possível desenhar a etiqueta neste aparelho.");
  const f = camposEtiqueta(e);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";

  // Cabeçalho: logo + nome do produto
  const logo = await carregarLogo();
  if (logo) ctx.drawImage(logo, M, L.logo.y, L.logo.tam, L.logo.tam);
  const xNome = M + L.nomeX;
  const largNome = LARGURA_PONTOS - xNome - M;
  const { linhas, tamanho: tNome } = nomeEmLinhas(ctx, f.nome, largNome, L.nomeFonte);
  ctx.font = `900 ${tNome}px ${FONTE}`;
  let y = L.logo.y + tNome;
  for (const l of linhas) {
    ctx.fillText(l, xNome, y);
    y += tNome + 2;
  }
  // Linha de baixo do cabeçalho: [ABERTO] + empresa · setor
  const ySub = Math.min(Math.max(y + 4, L.sub.min), L.sub.max);
  let xSub = xNome;
  if (f.tag) {
    ctx.font = `900 ${L.sub.fonte}px ${FONTE}`;
    const w = ctx.measureText(f.tag).width + 12;
    ctx.fillRect(xSub, ySub - L.sub.fonte - 1, w, L.sub.fonte + 6);
    ctx.fillStyle = "#fff";
    ctx.fillText(f.tag, xSub + 6, ySub);
    ctx.fillStyle = "#000";
    xSub += w + 8;
  }
  textoAjustado(ctx, f.subtitulo, xSub, ySub, LARGURA_PONTOS - xSub - M, 700, L.sub.fonte, 9);

  // Linha divisória
  ctx.fillRect(M, L.divisoria, LARGURA_PONTOS - 2 * M, 4);

  // Campos
  const tamQr = L.qr.tam;
  const xQr = LARGURA_PONTOS - M - tamQr;
  const xValor = M + L.valorX;
  let yl = L.campos.y;
  const passo = f.linhas.length > 5 ? L.campos.passoApertado : L.campos.passo;
  for (const linha of f.linhas) {
    textoAjustado(ctx, linha.rotulo, M, yl, L.rotuloLarg, 500, L.campos.fonte);
    textoAjustado(ctx, linha.valor, xValor, yl, xQr - xValor - 8, 800, L.campos.fonte);
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
        if (qr.modules.get(r, col)) ctx.fillRect(xQr + desloc + col * modulo, L.qr.y + desloc + r * modulo, modulo, modulo);
      }
    }
  } catch {
    // sem QR: o resto da etiqueta continua valendo
  }

  // Faixa VENCE
  const yFaixa = L.faixa.y;
  ctx.fillRect(0, yFaixa, LARGURA_PONTOS, L.faixa.alt);
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${L.faixa.texto}px ${FONTE}`;
  ctx.fillText("VENCE", M, yFaixa + L.faixa.textoY);
  textoAjustado(ctx, f.venceDia, LARGURA_PONTOS / 2 + 10, yFaixa + L.faixa.diaY, 270, 900, L.faixa.dia, 18, "center");
  ctx.font = `800 ${L.faixa.texto}px ${FONTE}`;
  ctx.textAlign = "right";
  ctx.fillText(f.venceHora, LARGURA_PONTOS - M, yFaixa + L.faixa.textoY);
  ctx.textAlign = "left";
  ctx.fillStyle = "#000";

  // Rodapé
  textoAjustado(ctx, f.lote, M, L.rodape.y, 200, 700, L.rodape.fonte, 9);
  textoAjustado(ctx, f.cnpj, LARGURA_PONTOS - M, L.rodape.y, 240, 700, L.rodape.fonte, 9, "right");

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
  { valor: "rawbt-tspl", rotulo: "RawBT modo direto (recomendado)", ajuda: "Manda os comandos de etiqueta (TSPL) prontos para a Knup KP-IM608 pelo RawBT." },
  { valor: "rawbt-pdf", rotulo: "RawBT por PDF", ajuda: "Para impressoras que não aceitam o modo direto." },
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
  return "rawbt-tspl";
}

export function salvarModo(m: ModoImpressao) {
  try {
    localStorage.setItem(CHAVE_MODO, m);
  } catch {
    // ignora
  }
}

const CHAVE_TAMANHO = "prod_etiqueta_tamanho";

export const OPCOES_TAMANHO: { valor: TamanhoEtiqueta; rotulo: string }[] = [
  { valor: "60x50", rotulo: "60 x 50 mm" },
  { valor: "60x40", rotulo: "60 x 40 mm" },
];

export function lerTamanho(): TamanhoEtiqueta {
  try {
    const v = localStorage.getItem(CHAVE_TAMANHO);
    if (v === "60x50" || v === "60x40") return v;
  } catch {
    // sem armazenamento: usa o padrão
  }
  return "60x50";
}

export function salvarTamanho(t: TamanhoEtiqueta) {
  try {
    localStorage.setItem(CHAVE_TAMANHO, t);
  } catch {
    // ignora
  }
}

export interface ItemImpressao {
  etiqueta: EtiquetaEmitida;
  copias: number;
}

export interface ResultadoImpressao {
  /** Prévia (PNG) de cada etiqueta, na ordem da lista. */
  previas: string[];
  /** Envios que ainda faltam mandar para o RawBT (listas grandes vão em partes). */
  restantes: string[];
}

/** Tamanho máximo de cada envio para o RawBT (o Android limita o tamanho do link). */
const LIMITE_ENVIO = 420_000;

/**
 * Desenha todas as etiquetas e manda para a impressora num envio só.
 * Se a lista for muito grande, manda a primeira parte e devolve as outras em `restantes`.
 */
export async function imprimirVarias(lista: ItemImpressao[], modo: ModoImpressao): Promise<ResultadoImpressao> {
  if (lista.length === 0) return { previas: [], restantes: [] };
  const origem = window.location.origin;
  const tamanho = lerTamanho();
  const T = TAMANHOS[tamanho];
  const canvases: HTMLCanvasElement[] = [];
  for (const item of lista) canvases.push(await desenharEtiqueta(item.etiqueta, origem, tamanho));
  const previas = canvases.map((c) => c.toDataURL("image/png"));

  if (modo === "navegador") {
    imprimirPeloNavegador(previas.map((png, i) => ({ png, copias: lista[i]!.copias })), T.larguraMm, T.alturaMm);
    return { previas, restantes: [] };
  }

  let envios: string[];
  if (modo === "rawbt-pdf") {
    const imagens = canvases.map((c, i) => ({
      jpeg: deBase64(c.toDataURL("image/jpeg", 0.95).split(",")[1] ?? ""),
      copias: lista[i]!.copias,
    }));
    envios = dividirEnvios(imagens, (im) => im.jpeg.length + 600, LIMITE_ENVIO).map(
      (parte) => `rawbt:data:application/pdf;base64,${paraBase64(pdfVarias(parte, T.largura, T.altura, T.larguraMm, T.alturaMm))}`,
    );
  } else {
    const bitmaps = canvases.map((c, i) => {
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Não foi possível preparar a etiqueta.");
      return { mono: bitmap1Bit(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height), copias: lista[i]!.copias };
    });
    envios = dividirEnvios(bitmaps, (b) => b.mono.length + 60, LIMITE_ENVIO).map(
      (parte) => `rawbt:base64,${paraBase64(tsplVarias(parte, T.largura, T.altura, T.larguraMm, T.alturaMm))}`,
    );
  }
  const [primeiro, ...restantes] = envios;
  if (primeiro) enviarParaRawbt(primeiro);
  return { previas, restantes };
}

/** Abre o RawBT com um envio já preparado. */
export function enviarParaRawbt(url: string) {
  window.location.href = url;
}

/** Envia uma etiqueta (com cópias) para a impressora. Retorna a imagem (para a prévia). */
export async function imprimirEtiqueta(e: EtiquetaEmitida, copias: number, modo: ModoImpressao): Promise<string> {
  const r = await imprimirVarias([{ etiqueta: e, copias }], modo);
  return r.previas[0] ?? "";
}

function imprimirPeloNavegador(lista: { png: string; copias: number }[], larguraMm: number, alturaMm: number) {
  const id = "area-impressao-etiquetas";
  document.getElementById(id)?.remove();
  document.getElementById(`${id}-estilo`)?.remove();
  const estilo = document.createElement("style");
  estilo.id = `${id}-estilo`;
  estilo.textContent = `@media print { @page { size: ${larguraMm}mm ${alturaMm}mm; margin: 0; } .so-impressao img { width: ${larguraMm}mm !important; height: ${alturaMm}mm !important; } }`;
  document.head.appendChild(estilo);
  const area = document.createElement("div");
  area.id = id;
  area.className = "so-impressao";
  for (const { png, copias } of lista) {
    for (let i = 0; i < Math.max(1, copias); i++) {
      const img = document.createElement("img");
      img.src = png;
      img.alt = "";
      area.appendChild(img);
    }
  }
  document.body.appendChild(area);
  const imgs = Array.from(area.querySelectorAll("img"));
  Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => (i.onload = r))))).then(() => {
    window.print();
  });
}
