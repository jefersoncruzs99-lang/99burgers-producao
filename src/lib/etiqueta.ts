import { FUSO } from "./datas";
import type { Conservacao, EtiquetaEmitida, EtiquetaItem, TipoEtiqueta } from "./tipos";

export const ROTULO_CONSERVACAO: Record<Conservacao, string> = {
  resfriado: "Resfriado",
  congelado: "Congelado",
  ambiente: "Ambiente",
};

export const ROTULO_TIPO: Record<TipoEtiqueta, string> = {
  preparo: "Feito na cozinha",
  aberto: "Produto aberto",
  descongelado: "Descongelado",
};

/** Como a data de manipulação é chamada na etiqueta, conforme o tipo. */
export const ROTULO_DATA: Record<TipoEtiqueta, string> = {
  preparo: "Manipulação",
  aberto: "Aberto em",
  descongelado: "Descongelado",
};

export interface OpcaoConservacao {
  conservacao: Conservacao;
  dias: number | null; // null = digitar o prazo da embalagem
}

/**
 * Conservações que o tablet oferece para o item.
 * Mostra as que têm prazo cadastrado; se nenhuma tiver (industrializado aberto),
 * oferece resfriado/congelado/ambiente com o prazo digitado da embalagem.
 */
export function opcoesConservacao(item: Pick<EtiquetaItem, "dias_resfriado" | "dias_congelado" | "dias_ambiente">): OpcaoConservacao[] {
  const comPrazo: OpcaoConservacao[] = [];
  if (item.dias_resfriado !== null) comPrazo.push({ conservacao: "resfriado", dias: item.dias_resfriado });
  if (item.dias_congelado !== null) comPrazo.push({ conservacao: "congelado", dias: item.dias_congelado });
  if (item.dias_ambiente !== null) comPrazo.push({ conservacao: "ambiente", dias: item.dias_ambiente });
  if (comPrazo.length > 0) return comPrazo;
  return [
    { conservacao: "resfriado", dias: null },
    { conservacao: "congelado", dias: null },
    { conservacao: "ambiente", dias: null },
  ];
}

function partes(iso: string): Record<string, string> {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const r: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(iso))) r[p.type] = p.value;
  return r;
}

/** 27/10/26 */
export function dataEtiqueta(iso: string): string {
  const p = partes(iso);
  return `${p.day}/${p.month}/${p.year}`;
}

/** 11:42 */
export function horaEtiqueta(iso: string): string {
  const p = partes(iso);
  const h = p.hour === "24" ? "00" : p.hour;
  return `${h}:${p.minute}`;
}

/** QUI */
export function diaSemanaEtiqueta(iso: string): string {
  const p = partes(iso);
  return (p.weekday ?? "").replace(".", "").slice(0, 3).toUpperCase();
}

/** "2026-01-15" → 15/01/26 */
export function dataSimples(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${(a ?? "").slice(2)}`;
}

export function textoValidade(dias: number): string {
  if (dias === 0) return "Mesmo dia";
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

export interface LinhaEtiqueta {
  rotulo: string;
  valor: string;
}

/** Tudo que vai impresso na etiqueta (modelo A), já formatado. */
export function camposEtiqueta(e: EtiquetaEmitida) {
  const linhas: LinhaEtiqueta[] = [
    { rotulo: "Conservação", valor: ROTULO_CONSERVACAO[e.conservacao].toUpperCase() },
    { rotulo: "Temperatura", valor: e.temperatura },
    { rotulo: ROTULO_DATA[e.tipo], valor: `${dataEtiqueta(e.manipulado_em)} · ${horaEtiqueta(e.manipulado_em)}` },
    { rotulo: "Validade", valor: textoValidade(e.validade_dias) },
    { rotulo: "Responsável", valor: e.responsavel },
  ];
  if (e.validade_original) linhas.push({ rotulo: "Val. original", valor: dataSimples(e.validade_original) });
  return {
    tag: e.tipo === "aberto" ? "ABERTO" : e.tipo === "descongelado" ? "DESCONGELADO" : null,
    nome: e.nome.toUpperCase(),
    subtitulo: [e.empresa ?? "NOVE NOVE BURGER'S", e.setor].filter(Boolean).join(" · "),
    linhas,
    venceDia: `${diaSemanaEtiqueta(e.vence_em)} ${dataEtiqueta(e.vence_em)}`,
    venceHora: horaEtiqueta(e.vence_em),
    lote: `Lote ${e.lote}`,
    cnpj: e.cnpj ? `CNPJ ${e.cnpj}` : "",
  };
}

/** A etiqueta já venceu? */
export function vencida(e: Pick<EtiquetaEmitida, "vence_em">, agora: Date = new Date()): boolean {
  return new Date(e.vence_em).getTime() < agora.getTime();
}

/** Busca simples sem acento e sem maiúsculas. */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
