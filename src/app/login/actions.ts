"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { criarSupabaseServidor } from "@/lib/supabase/server";
import { texto } from "@/lib/form";

export type EstadoLogin = { erro?: string; ok?: string };

export async function entrar(_: EstadoLogin, fd: FormData): Promise<EstadoLogin> {
  const email = texto(fd, "email");
  const senha = texto(fd, "senha");
  if (!email || !senha) return { erro: "Informe e-mail e senha." };
  const supabase = await criarSupabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { erro: "E-mail ou senha incorretos." };
  redirect("/admin");
}

export async function recuperarSenha(_: EstadoLogin, fd: FormData): Promise<EstadoLogin> {
  const email = texto(fd, "email");
  if (!email) return { erro: "Informe o e-mail para recuperar a senha." };
  const h = await headers();
  const origem = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await criarSupabaseServidor();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origem}/auth/callback?proximo=/login/nova-senha`,
  });
  // Mesma resposta exista ou não a conta (não revela e-mails cadastrados).
  return { ok: "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha." };
}

export async function definirNovaSenha(_: EstadoLogin, fd: FormData): Promise<EstadoLogin> {
  const senha = texto(fd, "senha");
  const confirma = texto(fd, "confirma");
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (senha !== confirma) return { erro: "As senhas não conferem." };
  const supabase = await criarSupabaseServidor();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: "Link expirado. Peça a recuperação de senha novamente." };
  redirect("/admin");
}

export async function sair() {
  const supabase = await criarSupabaseServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
