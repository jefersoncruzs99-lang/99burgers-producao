import "server-only";
import { redirect } from "next/navigation";
import { criarSupabaseServidor } from "./supabase/server";

/**
 * Garante que quem está na área administrativa é um usuário do painel 99 Burgers
 * (perfil admin ou operator na tabela profiles). Validação feita no servidor.
 */
export async function exigirGestor() {
  const supabase = await criarSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?expirada=1");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || !["admin", "operator"].includes(String(perfil.role))) {
    await supabase.auth.signOut();
    redirect("/login?sem_acesso=1");
  }

  return {
    supabase,
    user,
    nome: String(perfil.display_name ?? user.email ?? "Gestor"),
    papel: String(perfil.role),
  };
}
