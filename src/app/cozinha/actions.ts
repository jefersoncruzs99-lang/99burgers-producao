"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { criarSupabaseServidor } from "@/lib/supabase/server";
import { COOKIE_COZINHA, rpcCozinha } from "@/lib/cozinha";
import { numeroOuNulo, texto, textoOuNulo, uuidOuNulo } from "@/lib/form";
import { itensDoFormulario } from "@/lib/estoque";
import type { EstadoContagem } from "@/components/FormContagem";
import type { Conservacao, EtiquetaEmitida } from "@/lib/tipos";

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
  const destino = texto(fd, "destino");
  redirect(destino === "/etiquetas" ? "/etiquetas" : "/cozinha");
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

// ===================== ETIQUETAS =====================

export type PedidoEtiqueta = {
  colaboradorId: string;
  itemId: string;
  conservacao: Conservacao;
  quantidade: number;
  dias?: number | null;
  validadeOriginal?: string | null;
  tarefaId?: string | null;
};

export type RespostaEtiqueta = { etiqueta?: EtiquetaEmitida; erro?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Registra a etiqueta no banco (gera o lote) e devolve os dados para imprimir. */
export async function emitirEtiqueta(p: PedidoEtiqueta): Promise<RespostaEtiqueta> {
  if (!UUID.test(p.colaboradorId) || !UUID.test(p.itemId)) return { erro: "Escolha o produto e a pessoa." };
  if (!["resfriado", "congelado", "ambiente"].includes(p.conservacao)) return { erro: "Escolha a conservação." };
  const qtd = Math.round(Number(p.quantidade));
  if (!Number.isFinite(qtd) || qtd < 1 || qtd > 50) return { erro: "Quantidade de etiquetas: de 1 a 50." };
  const dias = p.dias === null || p.dias === undefined ? null : Math.round(Number(p.dias));
  if (dias !== null && (!Number.isFinite(dias) || dias < 0 || dias > 3650)) return { erro: "Validade em dias inválida." };
  const original = p.validadeOriginal && /^\d{4}-\d{2}-\d{2}$/.test(p.validadeOriginal) ? p.validadeOriginal : null;
  try {
    const etiqueta = await rpcCozinha<EtiquetaEmitida>("prod_cozinha_emitir_etiqueta", {
      p_colaborador: p.colaboradorId,
      p_item: p.itemId,
      p_conservacao: p.conservacao,
      p_quantidade: qtd,
      p_dias: dias,
      p_validade_original: original,
      p_tarefa: p.tarefaId && UUID.test(p.tarefaId) ? p.tarefaId : null,
    });
    revalidatePath("/etiquetas", "layout");
    return { etiqueta };
  } catch (e) {
    if (e instanceof Error && e.message === "SEM_CODIGO") return { erro: "O tablet saiu da cozinha. Digite o código de novo." };
    return { erro: e instanceof Error ? e.message : "Não foi possível gerar a etiqueta." };
  }
}
