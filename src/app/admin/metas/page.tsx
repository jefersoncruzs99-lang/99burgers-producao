import Link from "next/link";
import { exigirGestor } from "@/lib/auth";
import { dataCurta, hojeISO, segundaDaSemana, somarDias } from "@/lib/datas";
import { DIAS_PRODUCAO, produzNaSemana } from "@/lib/estoque";
import { formatarQtd } from "@/lib/receita";
import type { Colaborador, ItemContagem, MetaEstoque, Produto, Setor } from "@/lib/tipos";
import { FormContagem } from "@/components/FormContagem";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { alternarMeta, salvarContagemAdmin, salvarMeta } from "../actions";

export default async function Metas({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const semana = segundaDaSemana(hojeISO());

  const [{ data: m, error }, { data: p }, { data: c }, { data: s }, { data: cont }] = await Promise.all([
    supabase.from("prod_metas_estoque").select("*").order("ordem"),
    supabase.from("prod_produtos").select("*").order("nome"),
    supabase.from("prod_colaboradores").select("*").order("nome"),
    supabase.from("prod_setores").select("*").order("nome"),
    supabase
      .from("prod_contagens")
      .select("*, prod_contagem_itens(produto_id, quantidade, a_produzir)")
      .eq("semana", semana)
      .maybeSingle(),
  ]);
  const metas = (m ?? []) as MetaEstoque[];
  const produtos = (p ?? []) as Produto[];
  const colaboradores = (c ?? []) as Colaborador[];
  const setores = (s ?? []) as Setor[];
  const prod = new Map(produtos.map((x) => [x.id, x]));
  const nomeColab = new Map(colaboradores.map((x) => [x.id, x.nome]));
  const nomeSetor = new Map(setores.map((x) => [x.id, x.nome]));
  type Contagem = {
    status: string;
    confirmada_em: string | null;
    prod_contagem_itens: { produto_id: string; quantidade: number; a_produzir: number | null }[];
  } | null;
  const contagem = cont as Contagem;
  const contado = new Map((contagem?.prod_contagem_itens ?? []).map((i) => [i.produto_id, i]));

  const editando = metas.find((x) => x.id === sp.editar) ?? null;
  const semMeta = produtos.filter((x) => x.ativo && (!metas.some((mt) => mt.produto_id === x.id) || x.id === editando?.produto_id));

  const ativas = metas.filter((x) => x.ativo && prod.get(x.produto_id)?.ativo);
  const itens: ItemContagem[] = ativas.map((x) => {
    const pr = prod.get(x.produto_id)!;
    return {
      produto_id: x.produto_id,
      produto: pr.nome,
      unidade: pr.unidade,
      meta: Number(x.meta),
      ciclo: x.ciclo,
      produz_semana: produzNaSemana(x.ciclo, x.semana_base, semana),
      quantidade: contado.get(x.produto_id)?.quantidade ?? null,
      a_produzir: contado.get(x.produto_id)?.a_produzir ?? null,
      setor: nomeSetor.get(pr.setor_id ?? "") ?? null,
    };
  });

  return (
    <>
      <h1>Metas de estoque</h1>
      <p className="muted">
        Para os produtos de estoque (geleias, molhos, bacon fatiado…). Toda segunda alguém conta quanto tem; ao
        confirmar, o sistema cria a tarefa de produção para o responsável com <strong>meta − estoque</strong>. Produtos
        diários continuam nas tarefas recorrentes.
      </p>
      <Mensagens erro={sp.erro ?? error?.message} ok={sp.ok} />

      <section className="cartao pilha destaque">
        <div className="linha entre">
          <h2>Contagem da semana ({dataCurta(semana)})</h2>
          <span className={`etiqueta ${contagem?.status === "confirmada" ? "concluida" : "pendente"}`}>
            {contagem?.status === "confirmada"
              ? `Confirmada ${contagem.confirmada_em ? new Date(contagem.confirmada_em).toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" }) : ""}`
              : contagem
                ? "Em andamento"
                : "Ainda não feita"}
          </span>
        </div>
        {itens.length === 0 ? (
          <p className="muted">Cadastre as metas abaixo para liberar a contagem.</p>
        ) : (
          <details open={contagem?.status !== "confirmada"}>
            <summary style={{ cursor: "pointer", fontWeight: 700, marginBottom: 12 }}>
              {contagem?.status === "confirmada" ? "Refazer / corrigir a contagem" : "Fazer a contagem por aqui"}
            </summary>
            <FormContagem itens={itens} acao={salvarContagemAdmin} />
          </details>
        )}
      </section>

      <form action={salvarMeta} className="cartao pilha" key={editando?.id ?? "nova"}>
        <h2>{editando ? `Editando meta: ${prod.get(editando.produto_id)?.nome}` : "Nova meta"}</h2>
        {editando && <input type="hidden" name="id" value={editando.id} />}
        <div className="campos">
          <div className="campo">
            <label htmlFor="produto_id">Produto</label>
            <select id="produto_id" name="produto_id" required defaultValue={editando?.produto_id ?? ""}>
              <option value="">Escolha</option>
              {semMeta.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome} ({x.unidade})
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="meta">Quanto precisa ter</label>
            <input id="meta" name="meta" inputMode="decimal" required defaultValue={editando ? String(editando.meta) : ""} placeholder="Ex.: 50" />
          </div>
          <div className="campo">
            <label htmlFor="ciclo">Ciclo</label>
            <select id="ciclo" name="ciclo" defaultValue={editando?.ciclo ?? "semanal"}>
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal (a cada 15 dias)</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="quinzena">Se quinzenal, produz…</label>
            <select id="quinzena" name="quinzena" defaultValue="">
              <option value="">{editando ? "Manter como está" : "Nesta semana"}</option>
              <option value="esta">Nesta semana</option>
              <option value="proxima">Na próxima semana</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="dia_producao">Dia de produzir</label>
            <select id="dia_producao" name="dia_producao" defaultValue={String(editando?.dia_producao ?? 1)}>
              {DIAS_PRODUCAO.map((d) => (
                <option key={d.valor} value={d.valor}>
                  {d.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="responsavel_id">Responsável fixo</label>
            <select id="responsavel_id" name="responsavel_id" defaultValue={editando?.responsavel_id ?? ""}>
              <option value="">Definir no dia</option>
              {colaboradores
                .filter((x) => x.ativo)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="duracao_estimada_min">Tempo estimado (min)</label>
            <input id="duracao_estimada_min" name="duracao_estimada_min" inputMode="numeric" defaultValue={editando?.duracao_estimada_min ?? ""} />
          </div>
          <div className="campo">
            <label htmlFor="ordem">Ordem</label>
            <input id="ordem" name="ordem" inputMode="numeric" defaultValue={editando?.ordem ?? 100} />
          </div>
        </div>
        <p className="muted pequeno">
          A receita vem da ficha técnica do produto (em Produtos e fichas) e aparece recalculada para a quantidade a
          produzir.
        </p>
        <div className="linha">
          <button className="botao primario">{editando ? "Salvar alterações" : "Criar meta"}</button>
          {editando && (
            <Link className="botao" href="/admin/metas">
              Cancelar
            </Link>
          )}
        </div>
      </form>

      <div className="cartao tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Meta</th>
              <th>Esta semana</th>
              <th>Quando / quem</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {metas.map((x) => {
              const pr = prod.get(x.produto_id);
              const ci = contado.get(x.produto_id);
              const produz = produzNaSemana(x.ciclo, x.semana_base, semana);
              const proxima = produz ? semana : somarDias(semana, 7);
              return (
                <tr key={x.id} style={{ opacity: x.ativo ? 1 : 0.5 }}>
                  <td>
                    <strong>{pr?.nome ?? "—"}</strong>
                    <div className="muted pequeno">{x.ciclo === "semanal" ? "Semanal" : "Quinzenal"}</div>
                  </td>
                  <td>{formatarQtd(Number(x.meta), pr?.unidade)}</td>
                  <td className="pequeno">
                    {!produz ? (
                      <span className="muted">Não produz (próxima: semana {dataCurta(proxima)})</span>
                    ) : ci ? (
                      <>
                        Tem {formatarQtd(Number(ci.quantidade), pr?.unidade)}
                        <br />
                        {ci.a_produzir !== null && Number(ci.a_produzir) > 0 ? (
                          <strong style={{ color: "var(--amarelo)" }}>Produzir {formatarQtd(Number(ci.a_produzir), pr?.unidade)}</strong>
                        ) : contagem?.status === "confirmada" ? (
                          <span className="muted">Estoque ok</span>
                        ) : (
                          <span className="muted">Aguardando confirmar</span>
                        )}
                      </>
                    ) : (
                      <span className="muted">Não contado</span>
                    )}
                  </td>
                  <td className="pequeno">
                    {DIAS_PRODUCAO.find((d) => d.valor === x.dia_producao)?.rotulo}
                    <br />
                    {x.responsavel_id ? nomeColab.get(x.responsavel_id) : <em className="muted">definir no dia</em>}
                  </td>
                  <td>
                    <div className="linha">
                      <Link className="botao" href={`/admin/metas?editar=${x.id}`}>
                        Editar
                      </Link>
                      <form action={alternarMeta}>
                        <input type="hidden" name="id" value={x.id} />
                        <input type="hidden" name="ativo" value={String(x.ativo)} />
                        <button className="botao">{x.ativo ? "Pausar" : "Reativar"}</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {metas.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhuma meta ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
