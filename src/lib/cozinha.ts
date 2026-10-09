import "server-only";
import { cookies } from "next/headers";
import { criarSupabaseServidor } from "./supabase/server";

export const COOKIE_COZINHA = "prod_cozinha";

/** Código da cozinha guardado no tablet (cookie httpOnly). */
export async function codigoCozinha(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE_COZINHA)?.value ?? null;
}

/** Chama uma função do tablet no banco passando o código da cozinha. */
export async function rpcCozinha<T>(funcao: string, args: Record<string, unknown> = {}): Promise<T> {
  const codigo = await codigoCozinha();
  if (!codigo) throw new Error("SEM_CODIGO");
  const supabase = await criarSupabaseServidor();
  const { data, error } = await supabase.rpc(funcao, { p_codigo: codigo, ...args });
  if (error) {
    if (error.message.includes("Código da cozinha inválido")) throw new Error("SEM_CODIGO");
    throw new Error(error.message);
  }
  return data as T;
}
