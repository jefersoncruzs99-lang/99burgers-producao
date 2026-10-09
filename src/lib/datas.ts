export const FUSO = "America/Bahia";

/** Data de hoje (AAAA-MM-DD) no fuso da operação. */
export function hojeISO(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

function parse(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function somarDias(iso: string, dias: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return fmt(d);
}

/** Segunda-feira da semana da data. */
export function segundaDaSemana(iso: string): string {
  const dow = parse(iso).getUTCDay(); // 0 = domingo
  const desloc = dow === 0 ? -6 : 1 - dow;
  return somarDias(iso, desloc);
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function dataLonga(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(parse(iso));
}

export const DIAS_SEMANA = [
  { valor: 1, rotulo: "Seg" },
  { valor: 2, rotulo: "Ter" },
  { valor: 3, rotulo: "Qua" },
  { valor: 4, rotulo: "Qui" },
  { valor: 5, rotulo: "Sex" },
  { valor: 6, rotulo: "Sáb" },
  { valor: 0, rotulo: "Dom" },
] as const;

/** A tarefa está atrasada? (prazo passou e não foi entregue) */
export function estaAtrasada(
  t: { status: string; data_execucao: string; janela_fim: string | null },
  hoje: string,
): boolean {
  const prazo = t.janela_fim ?? t.data_execucao;
  return prazo < hoje && t.status !== "concluida" && t.status !== "aguardando_aprovacao";
}
