export interface Ingrediente {
  nome: string;
  quantidade: number;
  unidade: string;
}

export interface FichaBase {
  rendimento: number;
  unidade_rendimento: string;
  ingredientes: Ingrediente[];
}

export interface FichaAjustada {
  fator: number;
  ajustada: boolean;
  aviso: string | null;
  ingredientes: Ingrediente[];
}

const normaliza = (u: string) => u.trim().toLowerCase();

/** Converte quantidades entre unidades de mesma grandeza (kg/g, l/ml). Retorna null se incompatíveis. */
export function converter(qtd: number, de: string, para: string): number | null {
  const a = normaliza(de);
  const b = normaliza(para);
  if (a === b) return qtd;
  const massa: Record<string, number> = { kg: 1000, g: 1 };
  const volume: Record<string, number> = { l: 1000, ml: 1 };
  for (const tabela of [massa, volume]) {
    const fa = tabela[a];
    const fb = tabela[b];
    if (fa !== undefined && fb !== undefined) return (qtd * fa) / fb;
  }
  return null;
}

/** Arredonda para exibição na cozinha (até 2 casas, sem zeros sobrando). */
export function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Recalcula a ficha técnica para a quantidade pedida na tarefa.
 * Ex.: ficha rende 1 kg, tarefa pede 3 kg → todos os ingredientes × 3.
 */
export function ajustarFicha(
  ficha: FichaBase,
  quantidadePedida: number | null | undefined,
  unidadePedida: string | null | undefined,
): FichaAjustada {
  const original: FichaAjustada = {
    fator: 1,
    ajustada: false,
    aviso: null,
    ingredientes: ficha.ingredientes.map((i) => ({ ...i })),
  };
  if (quantidadePedida === null || quantidadePedida === undefined || !(quantidadePedida > 0)) {
    return original;
  }
  if (!(ficha.rendimento > 0)) {
    return { ...original, aviso: "Ficha sem rendimento cadastrado: mostrando a receita original." };
  }
  const pedidaNaUnidadeDaFicha = converter(
    quantidadePedida,
    unidadePedida ?? ficha.unidade_rendimento,
    ficha.unidade_rendimento,
  );
  if (pedidaNaUnidadeDaFicha === null) {
    return {
      ...original,
      aviso: `A tarefa está em ${unidadePedida} e a ficha rende em ${ficha.unidade_rendimento}: mostrando a receita original.`,
    };
  }
  const fator = pedidaNaUnidadeDaFicha / ficha.rendimento;
  return {
    fator,
    ajustada: Math.abs(fator - 1) > 1e-9,
    aviso: null,
    ingredientes: ficha.ingredientes.map((i) => ({ ...i, quantidade: arredondar(i.quantidade * fator) })),
  };
}

export function formatarQtd(qtd: number | null | undefined, unidade?: string | null): string {
  if (qtd === null || qtd === undefined) return "";
  const n = arredondar(Number(qtd)).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return unidade ? `${n} ${unidade}` : n;
}
