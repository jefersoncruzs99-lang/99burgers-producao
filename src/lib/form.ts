/** Helpers para ler FormData com validação simples. */

export function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

export function textoOuNulo(fd: FormData, campo: string): string | null {
  const v = texto(fd, campo);
  return v === "" ? null : v;
}

/** Número não negativo (aceita vírgula). Retorna null se vazio. Lança erro se inválido. */
export function numeroOuNulo(fd: FormData, campo: string, rotulo = campo): number | null {
  const bruto = texto(fd, campo).replace(",", ".");
  if (bruto === "") return null;
  const n = Number(bruto);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${rotulo}: informe um número válido (não negativo).`);
  return n;
}

export function inteiroOuNulo(fd: FormData, campo: string, rotulo = campo): number | null {
  const n = numeroOuNulo(fd, campo, rotulo);
  return n === null ? null : Math.round(n);
}

export function marcado(fd: FormData, campo: string): boolean {
  const v = fd.get(campo);
  return v === "on" || v === "true" || v === "1";
}

export function uuidOuNulo(fd: FormData, campo: string): string | null {
  const v = texto(fd, campo);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
}

export function exigir(valor: string, rotulo: string): string {
  if (!valor) throw new Error(`${rotulo} é obrigatório.`);
  return valor;
}
