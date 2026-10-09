"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { criarSupabaseServidor } from "@/lib/supabase/server";
import { COOKIE_COZINHA, rpcCozinha } from "@/lib/cozinha";
import { numeroOuNulo, texto, textoOuNulo, uuidOuNulo } from "@/lib/form";
import { itensDoFormulario } from "@/lib/estoque";
import type { EstadoContagem } from "@/components/FormContagem";

export type EstadoCodigo = { erro?: string };

export async function entrarCozinha(_: EstadoCodigo, fd: FormData): Promise<EstadoCodigo> {
  const codigo = texto(fd, "codigo");
  if (!codigo) return { erro: "Digite o código da cozinha." };
  const supabase = await criarSupabaseServidor();
  const { data, error } = await supabase.rpc("prod_codigo_valido", { p_codigo: codigo });
  if (error) return { erro: "Não foi possível conferir o código. Tente de novo." };
  if (data !== true) return { erro: "Código incorreto." };
  const c = await cookies();
  c.set(COOKIE_COZINHA, codigo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/cozinha");
}

export async function sairCozinha() {
  const c = await cookies();
  c.delete(COOKIE_COZINHA);
  redirect("/cozinha");
}

export type EstadoTarefa = { erro?: string; ok?: string };

export async function iniciarTarefa(fd: FormData) {
  const colaborador = uuidOuNulo(fd, "colaborador_id");
  const tarefa = uuidOuNulo(fd, "tarefa_id");
  if (!colaborador || !tarefa) return;
  try {
    await rpcCozinha("prod_cozinha_iniciar", { p_colaborador: colaborador, p_tarefa: tarefa });
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof Error && e.message === "SEM_CODIGO") redirect("/cozinha");
  }
  revalidatePath(`/cozinha/${colaborador}`);
}

export async function concluirTarefa(_: EstadoTarefa, fd: FormData): Promise<EstadoTarefa> {
  const colaborador = uuidOuNulo(fd, "colaborador_id");
  const tarefa = uuidOuNulo(fd, "tarefa_id");
  if (!colaborador || !tarefa) return { erro: "Tarefa inválida." };
  try {
    const status = await rpcCozinha<string>("prod_cozinha_concluir", {
      p_colaborador: colaborador,
      p_tarefa: tarefa,
      p_quantidade: numeroOuNulo(fd, "quantidade", "Quantidade feita"),
      p_observacoes: textoOuNulo(fd, "observacoes"),
      p_foto: textoOuNulo(fd, "foto"),
    });
    revalidatePath(`/cozinha/${colaborador}`);
    return { ok: status === "aguardando_aprovacao" ? "Entregue! Aguardando aprovação da líder." : "Tarefa concluída! 👏" };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof Error && e.message === "SEM_CODIGO") redirect("/cozinha");
    return { erro: e instanceof Error ? e.message : "Não foi possível concluir." };
  }
}

export async function salvarContagemCozinha(_: EstadoContagem, fd: FormData): Promise<EstadoContagem> {
  try {
    const colaborador = uuidOuNulo(fd, "colaborador_id");
    if (!colaborador) return { erro: "Escolha quem está fazendo a contagem." };
    const confirmar = texto(fd, "confirmar") === "sim";
    const r = await rpcCozinha<{ tarefas_ajustadas?: number }>("prod_cozinha_salvar_contagem", {
      p_colaborador: colaborador,
      p_itens: itensDoFormulario(fd),
      p_confirmar: confirmar,
    });
    revalidatePath("/cozinha", "layout");
    return {
      ok: confirmar
        ? `Contagem confirmada! ${r?.tarefas_ajustadas ?? 0} tarefa(s) de produção atualizadas para a equipe.`
        : "Contagem salva. Você pode terminar depois.",
    };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof Error && e.message === "SEM_CODIGO") redirect("/cozinha");
    return { erro: e instanceof Error ? e.message : "Não foi possível salvar a contagem." };
  }
}
