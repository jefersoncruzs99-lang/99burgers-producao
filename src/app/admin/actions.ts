"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { exigirGestor } from "@/lib/auth";
import {
  exigir,
  inteiroOuNulo,
  marcado,
  numeroOuNulo,
  texto,
  textoOuNulo,
  uuidOuNulo,
} from "@/lib/form";
import { hojeISO, segundaDaSemana, somarDias } from "@/lib/datas";
import { itensDoFormulario } from "@/lib/estoque";
import type { EstadoContagem } from "@/components/FormContagem";

/** Executa a ação; em caso de erro volta para a página com a mensagem. */
async function executar(caminho: string, fn: () => Promise<void>, sucesso?: string) {
  let destino = caminho;
  try {
    await fn();
    if (sucesso) destino = `${caminho}${caminho.includes("?") ? "&" : "?"}ok=${encodeURIComponent(sucesso)}`;
  } catch (e) {
    unstable_rethrow(e); // deixa passar redirecionamentos (ex.: sessão expirada)
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    destino = `${caminho}${caminho.includes("?") ? "&" : "?"}erro=${encodeURIComponent(msg)}`;
  }
  revalidatePath("/admin", "layout");
  redirect(destino);
}

function falhou(error: { message: string } | null) {
  if (error) throw new Error(traduzirErro(error.message));
}

function traduzirErro(msg: string): string {
  if (msg.includes("duplicate key")) return "Já existe um registro com esses dados.";
  if (msg.includes("violates check constraint")) return "Valor inválido (verifique quantidades e datas).";
  return msg;
}

function voltar(fd: FormData, padrao: string): string {
  const v = texto(fd, "_voltar");
  return v.startsWith("/admin") ? v : padrao;
}

// ===================== QUADRO DO DIA =====================

export async function gerarTarefasDoDia(fd: FormData) {
  const data = texto(fd, "data") || hojeISO();
  await executar(`/admin?data=${data}`, async () => {
    const { supabase } = await exigirGestor();
    const { error } = await supabase.rpc("prod_gerar_tarefas", { p_data: data });
    falhou(error);
  }, "Tarefas recorrentes geradas.");
}

export async function criarTarefa(fd: FormData) {
  const data = texto(fd, "data_execucao") || hojeISO();
  await executar(`/admin?data=${data}`, async () => {
    const { supabase } = await exigirGestor();
    const tipo = texto(fd, "tipo");
    const janelaFim = tipo === "semanal" ? exigir(texto(fd, "janela_fim"), "Prazo final") : data;
    if (janelaFim < data) throw new Error("O prazo final não pode ser antes do início.");
    const produtoId = uuidOuNulo(fd, "produto_id");
    let unidade = textoOuNulo(fd, "unidade");
    if (produtoId && !unidade) {
      const { data: p } = await supabase.from("prod_produtos").select("unidade").eq("id", produtoId).single();
      unidade = p?.unidade ?? null;
    }
    const { error } = await supabase.from("prod_tarefas").insert({
      titulo: exigir(texto(fd, "titulo"), "Título"),
      instrucoes: textoOuNulo(fd, "instrucoes"),
      setor_id: uuidOuNulo(fd, "setor_id"),
      colaborador_id: exigir(uuidOuNulo(fd, "colaborador_id") ?? "", "Responsável"),
      produto_id: produtoId,
      quantidade_planejada: numeroOuNulo(fd, "quantidade_planejada", "Quantidade"),
      unidade,
      data_execucao: data,
      janela_inicio: data,
      janela_fim: janelaFim,
      duracao_estimada_min: inteiroOuNulo(fd, "duracao_estimada_min", "Duração"),
      exige_foto: marcado(fd, "exige_foto"),
      exige_aprovacao: marcado(fd, "exige_aprovacao"),
    });
    falhou(error);
  }, "Tarefa criada.");
}

export async function reatribuirTarefa(fd: FormData) {
  await executar(voltar(fd, "/admin"), async () => {
    const { supabase } = await exigirGestor();
    const id = exigir(uuidOuNulo(fd, "id") ?? "", "Tarefa");
    const colaborador = uuidOuNulo(fd, "colaborador_id");
    const { error } = await supabase.from("prod_tarefas").update({ colaborador_id: colaborador }).eq("id", id);
    falhou(error);
  });
}

/** Remove apenas tarefas que ainda não começaram (não apaga histórico de execução). */
export async function removerTarefa(fd: FormData) {
  await executar(voltar(fd, "/admin"), async () => {
    const { supabase } = await exigirGestor();
    const id = exigir(uuidOuNulo(fd, "id") ?? "", "Tarefa");
    const { data, error } = await supabase
      .from("prod_tarefas")
      .delete()
      .eq("id", id)
      .eq("status", "pendente")
      .is("inicio_real", null)
      .select("id");
    falhou(error);
    if (!data || data.length === 0) throw new Error("Só é possível remover tarefas que ainda não começaram.");
  }, "Tarefa removida.");
}

// ===================== APROVAÇÕES =====================

export async function avaliarTarefa(fd: FormData) {
  await executar("/admin/aprovacoes", async () => {
    const { supabase, user } = await exigirGestor();
    const id = exigir(uuidOuNulo(fd, "id") ?? "", "Tarefa");
    const decisao = texto(fd, "decisao");
    const motivo = textoOuNulo(fd, "motivo");
    if (decisao === "reprovar" && !motivo) throw new Error("Diga o motivo para o colaborador refazer.");
    const { data, error } = await supabase
      .from("prod_tarefas")
      .update({
        status: decisao === "aprovar" ? "concluida" : "reprovada",
        motivo_reprovacao: decisao === "aprovar" ? null : motivo,
        avaliado_por: user.id,
        avaliado_em: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "aguardando_aprovacao")
      .select("id");
    falhou(error);
    if (!data || data.length === 0) throw new Error("Esta tarefa não está mais aguardando aprovação.");
  }, decisao(fd) === "aprovar" ? "Tarefa aprovada." : "Tarefa devolvida para refazer.");
}

function decisao(fd: FormData) {
  return texto(fd, "decisao");
}

// ===================== EQUIPE =====================

export async function criarSetor(fd: FormData) {
  await executar("/admin/equipe", async () => {
    const { supabase } = await exigirGestor();
    const { error } = await supabase.from("prod_setores").insert({
      nome: exigir(texto(fd, "nome"), "Nome do setor"),
      descricao: textoOuNulo(fd, "descricao"),
    });
    falhou(error);
  }, "Setor criado.");
}

export async function alternarSetor(fd: FormData) {
  await executar("/admin/equipe", async () => {
    const { supabase } = await exigirGestor();
    const { error } = await supabase
      .from("prod_setores")
      .update({ ativo: texto(fd, "ativo") !== "true" })
      .eq("id", exigir(uuidOuNulo(fd, "id") ?? "", "Setor"));
    falhou(error);
  });
}

export async function salvarColaborador(fd: FormData) {
  await executar("/admin/equipe", async () => {
    const { supabase } = await exigirGestor();
    const id = uuidOuNulo(fd, "id");
    const dados = {
      nome: exigir(texto(fd, "nome"), "Nome"),
      setor_id: exigir(uuidOuNulo(fd, "setor_id") ?? "", "Setor"),
    };
    const { error } = id
      ? await supabase.from("prod_colaboradores").update(dados).eq("id", id)
      : await supabase.from("prod_colaboradores").insert(dados);
    falhou(error);
  }, "Colaborador salvo.");
}

export async function alternarColaborador(fd: FormData) {
  await executar("/admin/equipe", async () => {
    const { supabase } = await exigirGestor();
    const { error } = await supabase
      .from("prod_colaboradores")
      .update({ ativo: texto(fd, "ativo") !== "true" })
      .eq("id", exigir(uuidOuNulo(fd, "id") ?? "", "Colaborador"));
    falhou(error);
  });
}

// ===================== PRODUTOS E FICHAS =====================

export async function salvarProduto(fd: FormData) {
  const id = uuidOuNulo(fd, "id");
  await executar(id ? `/admin/produtos/${id}` : "/admin/produtos", async () => {
    const { supabase } = await exigirGestor();
    const dados = {
      nome: exigir(texto(fd, "nome"), "Nome do produto"),
      descricao: textoOuNulo(fd, "descricao"),
      setor_id: uuidOuNulo(fd, "setor_id"),
      unidade: texto(fd, "unidade") || "kg",
    };
    const { error } = id
      ? await supabase.from("prod_produtos").update(dados).eq("id", id)
      : await supabase.from("prod_produtos").insert(dados);
    falhou(error);
  }, "Produto salvo.");
}

export async function alternarProduto(fd: FormData) {
  await executar("/admin/produtos", async () => {
    const { supabase } = await exigirGestor();
    const { error } = await supabase
      .from("prod_produtos")
      .update({ ativo: texto(fd, "ativo") !== "true" })
      .eq("id", exigir(uuidOuNulo(fd, "id") ?? "", "Produto"));
    falhou(error);
  });
}

/**
 * Salva a ficha técnica como NOVA VERSÃO (a anterior fica guardada, desativada).
 * Ingredientes chegam como campos ing_nome[], ing_qtd[], ing_un[].
 */
export async function salvarFicha(fd: FormData) {
  const produtoId = uuidOuNulo(fd, "produto_id") ?? "";
  await executar(`/admin/produtos/${produtoId}`, async () => {
    const { supabase } = await exigirGestor();
    exigir(produtoId, "Produto");
    const rendimento = numeroOuNulo(fd, "rendimento", "Rendimento");
    if (!rendimento || rendimento <= 0) throw new Error("Informe quanto a receita rende (maior que zero).");

    const nomes = fd.getAll("ing_nome").map((v) => String(v).trim());
    const qtds = fd.getAll("ing_qtd").map((v) => String(v).trim().replace(",", "."));
    const uns = fd.getAll("ing_un").map((v) => String(v).trim());
    const ingredientes = nomes
      .map((nome, i) => ({ nome, quantidade: Number(qtds[i] ?? ""), unidade: uns[i] || "kg", ordem: i + 1 }))
      .filter((i) => i.nome !== "");
    for (const i of ingredientes) {
      if (!Number.isFinite(i.quantidade) || i.quantidade < 0) {
        throw new Error(`Quantidade inválida no ingrediente "${i.nome}".`);
      }
    }

    const { data: atual } = await supabase
      .from("prod_fichas_tecnicas")
      .select("versao")
      .eq("produto_id", produtoId)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    const versao = (atual?.versao ?? 0) + 1;

    const { data: nova, error } = await supabase
      .from("prod_fichas_tecnicas")
      .insert({
        produto_id: produtoId,
        versao,
        rendimento,
        unidade_rendimento: texto(fd, "unidade_rendimento") || "kg",
        modo_preparo: textoOuNulo(fd, "modo_preparo"),
        armazenamento: textoOuNulo(fd, "armazenamento"),
        ativa: false,
      })
      .select("id")
      .single();
    falhou(error);
    if (!nova) throw new Error("Não foi possível salvar a ficha.");

    if (ingredientes.length > 0) {
      const { error: e2 } = await supabase
        .from("prod_ficha_ingredientes")
        .insert(ingredientes.map((i) => ({ ...i, ficha_id: nova.id })));
      if (e2) {
        await supabase.from("prod_fichas_tecnicas").delete().eq("id", nova.id);
        falhou(e2);
      }
    }

    // Só agora troca a versão ativa (a anterior fica no histórico).
    const { error: e3 } = await supabase
      .from("prod_fichas_tecnicas")
      .update({ ativa: false })
      .eq("produto_id", produtoId)
      .neq("id", nova.id);
    falhou(e3);
    const { error: e4 } = await supabase.from("prod_fichas_tecnicas").update({ ativa: true }).eq("id", nova.id);
    falhou(e4);
  }, "Ficha técnica salva.");
}

// ===================== MODELOS DE TAREFA =====================

export async function salvarModelo(fd: FormData) {
  const id = uuidOuNulo(fd, "id");
  await executar("/admin/modelos", async () => {
    const { supabase } = await exigirGestor();
    const frequencia = texto(fd, "frequencia");
    if (!["diaria", "semanal"].includes(frequencia)) throw new Error("Escolha diária ou semanal.");
    const dias = fd
      .getAll("dias_semana")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    if (frequencia === "diaria" && dias.length === 0) throw new Error("Marque pelo menos um dia da semana.");
    const prazo = inteiroOuNulo(fd, "prazo_dias", "Prazo") ?? 5;
    if (prazo > 6) throw new Error("O prazo da tarefa semanal vai de 0 a 6 dias depois da segunda-feira.");

    const produtoId = uuidOuNulo(fd, "produto_id");
    let unidade = textoOuNulo(fd, "unidade");
    if (produtoId && !unidade) {
      const { data: p } = await supabase.from("prod_produtos").select("unidade").eq("id", produtoId).single();
      unidade = p?.unidade ?? null;
    }

    const dados = {
      titulo: exigir(texto(fd, "titulo"), "Título"),
      descricao: textoOuNulo(fd, "descricao"),
      setor_id: exigir(uuidOuNulo(fd, "setor_id") ?? "", "Setor"),
      produto_id: produtoId,
      colaborador_padrao_id: uuidOuNulo(fd, "colaborador_padrao_id"),
      quantidade_padrao: numeroOuNulo(fd, "quantidade_padrao", "Quantidade"),
      unidade,
      duracao_estimada_min: inteiroOuNulo(fd, "duracao_estimada_min", "Duração"),
      frequencia,
      dias_semana: frequencia === "diaria" ? dias : [1, 2, 3, 4, 5, 6, 0],
      prazo_dias: prazo,
      exige_foto: marcado(fd, "exige_foto"),
      exige_aprovacao: marcado(fd, "exige_aprovacao"),
      ordem: inteiroOuNulo(fd, "ordem", "Ordem") ?? 100,
    };
    const { error } = id
      ? await supabase.from("prod_modelos_tarefa").update(dados).eq("id", id)
      : await supabase.from("prod_modelos_tarefa").insert(dados);
    falhou(error);
  }, "Tarefa recorrente salva. Ela aparece a partir da próxima geração do dia.");
}

export async function alternarModelo(fd: FormData) {
  await executar("/admin/modelos", async () => {
    const { supabase } = await exigirGestor();
    const { error } = await supabase
      .from("prod_modelos_tarefa")
      .update({ ativo: texto(fd, "ativo") !== "true" })
      .eq("id", exigir(uuidOuNulo(fd, "id") ?? "", "Modelo"));
    falhou(error);
  });
}

// ===================== CONFIGURAÇÃO =====================

export async function definirCodigoCozinha(fd: FormData) {
  await executar("/admin/config", async () => {
    const { supabase } = await exigirGestor();
    const codigo = texto(fd, "codigo");
    if (codigo !== texto(fd, "confirma")) throw new Error("Os códigos não conferem.");
    const { error } = await supabase.rpc("prod_definir_codigo", { p_codigo: codigo });
    falhou(error);
  }, "Código da cozinha atualizado. Digite o novo código no tablet.");
}

// ===================== METAS DE ESTOQUE E CONTAGEM =====================

export async function salvarMeta(fd: FormData) {
  const id = uuidOuNulo(fd, "id");
  await executar("/admin/metas", async () => {
    const { supabase } = await exigirGestor();
    const meta = numeroOuNulo(fd, "meta", "Meta");
    if (!meta || meta <= 0) throw new Error("Informe a meta (maior que zero).");
    const ciclo = texto(fd, "ciclo");
    if (!["semanal", "quinzenal"].includes(ciclo)) throw new Error("Escolha semanal ou quinzenal.");
    const dia = inteiroOuNulo(fd, "dia_producao", "Dia") ?? 1;
    if (dia < 1 || dia > 7) throw new Error("Dia de produção inválido.");
    const segunda = segundaDaSemana(hojeISO());
    const dados: Record<string, unknown> = {
      produto_id: exigir(uuidOuNulo(fd, "produto_id") ?? "", "Produto"),
      meta,
      ciclo,
      dia_producao: dia,
      responsavel_id: uuidOuNulo(fd, "responsavel_id"),
      duracao_estimada_min: inteiroOuNulo(fd, "duracao_estimada_min", "Duração"),
      ordem: inteiroOuNulo(fd, "ordem", "Ordem") ?? 100,
    };
    const quando = texto(fd, "quinzena");
    if (ciclo === "quinzenal" && (quando === "esta" || quando === "proxima")) {
      dados.semana_base = quando === "esta" ? segunda : somarDias(segunda, 7);
    }
    const { error } = id
      ? await supabase.from("prod_metas_estoque").update(dados).eq("id", id)
      : await supabase.from("prod_metas_estoque").insert(dados);
    falhou(error);
  }, "Meta salva.");
}

export async function alternarMeta(fd: FormData) {
  await executar("/admin/metas", async () => {
    const { supabase } = await exigirGestor();
    const { error } = await supabase
      .from("prod_metas_estoque")
      .update({ ativo: texto(fd, "ativo") !== "true" })
      .eq("id", exigir(uuidOuNulo(fd, "id") ?? "", "Meta"));
    falhou(error);
  });
}

export async function salvarContagemAdmin(_: EstadoContagem, fd: FormData): Promise<EstadoContagem> {
  try {
    const { supabase } = await exigirGestor();
    const confirmar = texto(fd, "confirmar") === "sim";
    const { data, error } = await supabase.rpc("prod_salvar_contagem", {
      p_itens: itensDoFormulario(fd),
      p_confirmar: confirmar,
    });
    if (error) return { erro: traduzirErro(error.message) };
    revalidatePath("/admin", "layout");
    return {
      ok: confirmar
        ? `Contagem confirmada. ${(data as { tarefas_ajustadas?: number })?.tarefas_ajustadas ?? 0} tarefa(s) de produção criadas ou ajustadas.`
        : "Contagem salva. Termine e confirme depois.",
    };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Erro ao salvar a contagem." };
  }
}
