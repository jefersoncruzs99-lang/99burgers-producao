import Link from "next/link";
import { exigirGestor } from "@/lib/auth";
import { dataCurta, dataLonga, estaAtrasada, hojeISO, somarDias } from "@/lib/datas";
import { formatarQtd } from "@/lib/receita";
import type { Colaborador, Produto, Setor, Tarefa } from "@/lib/tipos";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { Status } from "@/components/Status";
import { criarTarefa, gerarTarefasDoDia, reatribuirTarefa, removerTarefa } from "./actions";

const ABERTOS = ["pendente", "em_andamento", "reprovada", "atrasada"];

export default async function QuadroDoDia({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const hoje = hojeISO();
  const data = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") ? (sp.data as string) : hoje;
  const { supabase } = await exigirGestor();

  // Ao abrir o dia de hoje ou futuro, garante que as tarefas recorrentes existam.
  if (data >= hoje) await supabase.rpc("prod_gerar_tarefas", { p_data: data });

  const [setoresR, colabsR, produtosR, doDiaR, atrasadasR] = await Promise.all([
    supabase.from("prod_setores").select("*").eq("ativo", true).order("nome"),
    supabase.from("prod_colaboradores").select("*").order("nome"),
    supabase.from("prod_produtos").select("*").eq("ativo", true).order("nome"),
    supabase
      .from("prod_tarefas")
      .select("*")
      .lte("janela_inicio", data)
      .gte("janela_fim", data)
      .order("ordem")
      .order("titulo"),
    data === hoje
      ? supabase.from("prod_tarefas").select("*").lt("janela_fim", data).in("status", ABERTOS).order("janela_fim")
      : Promise.resolve({ data: [] as Tarefa[], error: null }),
  ]);

  const setores = (setoresR.data ?? []) as Setor[];
  const colaboradores = (colabsR.data ?? []) as Colaborador[];
  const ativos = colaboradores.filter((c) => c.ativo);
  const produtos = (produtosR.data ?? []) as Produto[];
  const tarefas = [...((atrasadasR.data ?? []) as Tarefa[]), ...((doDiaR.data ?? []) as Tarefa[])];
  const nomeColab = new Map(colaboradores.map((c) => [c.id, c.nome]));
  const erroCarga = setoresR.error ?? doDiaR.error;

  const grupos = [
    ...setores.map((s) => ({ id: s.id as string | null, nome: s.nome })),
    { id: null, nome: "Sem setor" },
  ]
    .map((g) => ({ ...g, tarefas: tarefas.filter((t) => (t.setor_id ?? null) === g.id) }))
    .filter((g) => g.id !== null || g.tarefas.length > 0);

  const voltarPara = `/admin?data=${data}`;

  return (
    <>
      <div className="linha entre">
        <div>
          <h1 style={{ textTransform: "capitalize" }}>{dataLonga(data)}</h1>
          <p className="muted pequeno">{data === hoje ? "Hoje" : `Dia ${dataCurta(data)}`}</p>
        </div>
        <div className="linha">
          <Link className="botao" href={`/admin?data=${somarDias(data, -1)}`} aria-label="Dia anterior">
            ←
          </Link>
          <Link className="botao" href="/admin">
            Hoje
          </Link>
          <Link className="botao" href={`/admin?data=${somarDias(data, 1)}`} aria-label="Próximo dia">
            →
          </Link>
          <form action={gerarTarefasDoDia}>
            <input type="hidden" name="data" value={data} />
            <button className="botao" title="Cria as tarefas recorrentes que ainda faltam neste dia">
              Gerar recorrentes
            </button>
          </form>
        </div>
      </div>

      <Mensagens erro={sp.erro ?? erroCarga?.message} ok={sp.ok} />

      {setores.length === 0 && (
        <div className="aviso">
          Nenhum setor cadastrado ainda. Comece em <Link href="/admin/equipe">Equipe</Link>.
        </div>
      )}

      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {grupos.map((g) => {
          const feitas = g.tarefas.filter((t) => t.status === "concluida").length;
          const atrasadas = g.tarefas.filter((t) => estaAtrasada(t, hoje)).length;
          return (
            <section key={g.id ?? "sem"} className="cartao pilha">
              <div className="linha entre">
                <h2>{g.nome}</h2>
                <span className="muted pequeno">
                  {feitas}/{g.tarefas.length} feitas
                  {atrasadas > 0 && <span style={{ color: "var(--vermelho)" }}> · {atrasadas} atrasada(s)</span>}
                </span>
              </div>
              {g.tarefas.length === 0 && <p className="muted">Nenhuma tarefa neste dia.</p>}
              {g.tarefas.map((t) => {
                const atrasada = estaAtrasada(t, hoje);
                const semResp = !t.colaborador_id;
                return (
                  <div
                    key={t.id}
                    className={`cartao pilha ${atrasada || semResp ? "alerta" : ""}`}
                    style={{ padding: 12, background: "var(--preto)" }}
                  >
                    <div className="linha entre">
                      <strong>{t.titulo}</strong>
                      <Status status={t.status} atrasada={atrasada} />
                    </div>
                    <div className="muted pequeno">
                      {t.quantidade_planejada !== null && (
                        <>
                          {formatarQtd(t.quantidade_planejada, t.unidade)}
                          {t.quantidade_realizada !== null && t.status === "concluida" && (
                            <> · feito {formatarQtd(t.quantidade_realizada, t.unidade)}</>
                          )}
                          {" · "}
                        </>
                      )}
                      {t.janela_fim && t.janela_fim !== t.janela_inicio
                        ? `Semana: ${dataCurta(t.janela_inicio)} a ${dataCurta(t.janela_fim)}`
                        : `Dia ${dataCurta(t.data_execucao)}`}
                      {t.duracao_estimada_min ? ` · ~${t.duracao_estimada_min} min` : ""}
                      {t.exige_foto ? " · 📷" : ""}
                    </div>
                    {t.status === "concluida" || t.status === "aguardando_aprovacao" ? (
                      <div className="pequeno">
                        Responsável: <strong>{nomeColab.get(t.colaborador_id ?? "") ?? "—"}</strong>
                      </div>
                    ) : (
                      <form action={reatribuirTarefa} className="linha" style={{ flexWrap: "nowrap" }}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="_voltar" value={voltarPara} />
                        <select name="colaborador_id" defaultValue={t.colaborador_id ?? ""} aria-label="Responsável">
                          <option value="">— Sem responsável —</option>
                          {ativos
                            .filter((c) => !t.setor_id || c.setor_id === t.setor_id || c.id === t.colaborador_id)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nome}
                              </option>
                            ))}
                        </select>
                        <button className="botao">OK</button>
                      </form>
                    )}
                    {t.status === "pendente" && (
                      <form action={removerTarefa}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="_voltar" value={voltarPara} />
                        <button className="botao perigo" style={{ minHeight: 34, padding: "4px 10px", fontSize: ".85rem" }}>
                          Remover
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <details className="cartao">
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>+ Nova tarefa avulsa para {dataCurta(data)}</summary>
        <form action={criarTarefa} className="pilha" style={{ marginTop: 12 }}>
          <input type="hidden" name="data_execucao" value={data} />
          <div className="campos">
            <div className="campo">
              <label htmlFor="titulo">O que fazer</label>
              <input id="titulo" name="titulo" required placeholder="Ex.: Fazer feijão" />
            </div>
            <div className="campo">
              <label htmlFor="setor_id">Setor</label>
              <select id="setor_id" name="setor_id" required>
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="colaborador_id">Responsável</label>
              <select id="colaborador_id" name="colaborador_id" required>
                <option value="">Escolha</option>
                {ativos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="produto_id">Produto (abre a ficha técnica)</label>
              <select id="produto_id" name="produto_id">
                <option value="">Nenhum</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({p.unidade})
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="quantidade_planejada">Quantidade</label>
              <input id="quantidade_planejada" name="quantidade_planejada" inputMode="decimal" placeholder="Ex.: 3" />
            </div>
            <div className="campo">
              <label htmlFor="unidade">Unidade</label>
              <input id="unidade" name="unidade" placeholder="Vazio = unidade do produto" />
            </div>
            <div className="campo">
              <label htmlFor="duracao_estimada_min">Tempo estimado (min)</label>
              <input id="duracao_estimada_min" name="duracao_estimada_min" inputMode="numeric" />
            </div>
            <div className="campo">
              <label htmlFor="tipo">Prazo</label>
              <select id="tipo" name="tipo" defaultValue="dia">
                <option value="dia">Só neste dia</option>
                <option value="semanal">Até uma data (tarefa da semana)</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="janela_fim">Prazo final (se for da semana)</label>
              <input id="janela_fim" name="janela_fim" type="date" min={data} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="instrucoes">Instruções</label>
            <textarea id="instrucoes" name="instrucoes" />
          </div>
          <div className="linha">
            <label className="check">
              <input type="checkbox" name="exige_foto" /> Exigir foto ao concluir
            </label>
            <label className="check">
              <input type="checkbox" name="exige_aprovacao" /> Precisa de aprovação
            </label>
          </div>
          <button className="botao primario">Criar tarefa</button>
        </form>
      </details>
    </>
  );
}
