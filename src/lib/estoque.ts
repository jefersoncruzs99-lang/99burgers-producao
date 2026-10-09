import { arredondar } from "./receita";

/** Quanto produzir: meta − o que tem (nunca negativo). Fora da semana do quinzenal, zero. */
export function aProduzir(meta: number, contado: number | null | undefined, produzNaSemana = true): number {
  if (!produzNaSemana || contado === null || contado === undefined || !Number.isFinite(contado)) return 0;
  return arredondar(Math.max(meta - contado, 0));
}

/** Lê a quantidade digitada (aceita vírgula). Vazio ou inválido = null. */
export function lerQuantidade(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const DIAS_PRODUCAO = [
  { valor: 1, rotulo: "Segunda" },
  { valor: 2, rotulo: "Terça" },
  { valor: 3, rotulo: "Quarta" },
  { valor: 4, rotulo: "Quinta" },
  { valor: 5, rotulo: "Sexta" },
  { valor: 6, rotulo: "Sábado" },
  { valor: 7, rotulo: "Domingo" },
] as const;

/** Mesma regra do banco: quinzenal produz semana sim, semana não a partir da semana base. */
export function produzNaSemana(ciclo: string, semanaBase: string, semana: string): boolean {
  if (ciclo === "semanal") return true;
  const dias = (Date.parse(`${semana}T00:00:00Z`) - Date.parse(`${semanaBase}T00:00:00Z`)) / 86_400_000;
  return Math.round(Math.abs(dias) / 7) % 2 === 0;
}

/** Converte o formulário de contagem no formato da função do banco. */
export function itensDoFormulario(fd: FormData): { produto_id: string; quantidade: number }[] {
  return fd
    .getAll("produto_id")
    .map(String)
    .map((id) => ({ id, bruto: String(fd.get(`q_${id}`) ?? "").trim().replace(",", ".") }))
    .filter((x) => x.bruto !== "")
    .map((x) => {
      const n = Number(x.bruto);
      if (!Number.isFinite(n) || n < 0) throw new Error("Confira as quantidades: use só números positivos.");
      return { produto_id: x.id, quantidade: n };
    });
}
