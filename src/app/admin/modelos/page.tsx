import Link from "next/link";
import { exigirGestor } from "@/lib/auth";
import { DIAS_SEMANA } from "@/lib/datas";
import { formatarQtd } from "@/lib/receita";
import type { Colaborador, ModeloTarefa, Produto, Setor } from "@/lib/tipos";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { alternarModelo, salvarModelo } from "../actions";

const PRAZOS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default async function Modelos({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const [{ data: m, error }, { data: s }, { data: c }, { data: p }] = await Promise.all([
    supabase.from("prod_modelos_tarefa").select("*").neq("frequencia", "avulsa").order("ordem").order("titulo"),
    supabase.from("prod_setores").select("*").order("nome"),
    supabase.from("prod_colaboradores").select("*").order("nome"),
    supabase.from("prod_produtos").select("*").eq("ativo", true).order("nome"),
  ]);
  const modelos = (m ?? []) as ModeloTarefa[];
  const setores = (s ?? []) as Setor[];
  const colaboradores = (c ?? []) as Colaborador[];
  const produtos = (p ?? []) as Produto[];
  const nomeSetor = new Map(setores.map((x) => [x.id, x.nome]));
  const nomeColab = new Map(colaboradores.map((x) => [x.id, x.nome]));
  const editando = modelos.find((x) => x.id === sp.editar) ?? null;

  return (
    <>
      <h1>Tarefas recorrentes</h1>
      <p className="muted">
        Cadastre aqui o que se repete. As diárias aparecem sozinhas nos dias marcados; as semanais aparecem na
        segunda-feira e ficam na lista do colaborador até ele entregar (ou até o prazo, quando viram atrasadas).
      </p>
      <Mensagens erro={sp.erro ?? error?.message} ok={sp.ok} />

      <form action={salvarModelo} className="cartao pilha destaque" key={editando?.id ?? "novo"}>
        <h2>{editando ? `Editando: ${editando.titulo}` : "Nova tarefa recorrente"}</h2>
        {editando && <input type="hidden" name="id" value={editando.id} />}
        <div className="campos">
          <div className="campo">
            <label htmlFor="titulo">O que fazer</label>
            <input id="titulo" name="titulo" required defaultValue={editando?.titulo} placeholder="Ex.: Limpar geladeira" />
          </div>
          <div className="campo">
            <label htmlFor="frequencia">Frequência</label>
            <select id="frequencia" name="frequencia" defaultValue={editando?.frequencia ?? "diaria"}>
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="setor_id">Setor</label>
            <select id="setor_id" name="setor_id" required defaultValue={editando?.setor_id ?? ""}>
              <option value="">Escolha</option>
              {setores
                .filter((x) => x.ativo || x.id === editando?.setor_id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="colaborador_padrao_id">Responsável</label>
            <select id="colaborador_padrao_id" name="colaborador_padrao_id" defaultValue={editando?.colaborador_padrao_id ?? ""}>
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
            <label htmlFor="produto_id">Produto (abre a ficha técnica)</label>
            <select id="produto_id" name="produto_id" defaultValue={editando?.produto_id ?? ""}>
              <option value="">Nenhum</option>
              {produtos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome} ({x.unidade})
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="quantidade_padrao">Quantidade</label>
            <input
              id="quantidade_padrao"
              name="quantidade_padrao"
              inputMode="decimal"
              defaultValue={editando?.quantidade_padrao ?? ""}
              placeholder="Ex.: 3"
            />
          </div>
          <div className="campo">
            <label htmlFor="unidade">Unidade</label>
            <input id="unidade" name="unidade" defaultValue={editando?.unidade ?? ""} placeholder="Vazio = unidade do produto" />
          </div>
          <div className="campo">
            <label htmlFor="duracao_estimada_min">Tempo estimado (min)</label>
            <input
              id="duracao_estimada_min"
              name="duracao_estimada_min"
              inputMode="numeric"
              defaultValue={editando?.duracao_estimada_min ?? ""}
            />
          </div>
          <div className="campo">
            <label htmlFor="prazo_dias">Prazo (se semanal)</label>
            <select id="prazo_dias" name="prazo_dias" defaultValue={String(editando?.prazo_dias ?? 5)}>
              {PRAZOS.map((d, i) => (
                <option key={d} value={i}>
                  Até {d.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="ordem">Ordem na lista</label>
            <input id="ordem" name="ordem" inputMode="numeric" defaultValue={editando?.ordem ?? 100} />
          </div>
        </div>
        <fieldset className="campo" style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>Dias (se diária)</legend>
          <div className="linha">
            {DIAS_SEMANA.map((d) => (
              <label key={d.valor} className="check">
                <input
                  type="checkbox"
                  name="dias_semana"
                  value={d.valor}
                  defaultChecked={editando ? editando.dias_semana.includes(d.valor) : d.valor !== 0}
                />
                {d.rotulo}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="campo">
          <label htmlFor="descricao">Instruções</label>
          <textarea id="descricao" name="descricao" defaultValue={editando?.descricao ?? ""} />
        </div>
        <div className="linha">
          <label className="check">
            <input type="checkbox" name="exige_foto" defaultChecked={editando?.exige_foto} /> Exigir foto ao concluir
          </label>
          <label className="check">
            <input type="checkbox" name="exige_aprovacao" defaultChecked={editando?.exige_aprovacao} /> Precisa de
            aprovação
          </label>
        </div>
        <div className="linha">
          <button className="botao primario">{editando ? "Salvar alterações" : "Criar tarefa recorrente"}</button>
          {editando && (
            <Link className="botao" href="/admin/modelos">
              Cancelar
            </Link>
          )}
        </div>
      </form>

      <div className="cartao tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Tarefa</th>
              <th>Quando</th>
              <th>Setor / responsável</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {modelos.map((x) => (
              <tr key={x.id} style={{ opacity: x.ativo ? 1 : 0.5 }}>
                <td>
                  <strong>{x.titulo}</strong>
                  <div className="muted pequeno">
                    {formatarQtd(x.quantidade_padrao, x.unidade)}
                    {x.duracao_estimada_min ? ` · ~${x.duracao_estimada_min} min` : ""}
                    {x.exige_foto ? " · 📷 foto" : ""}
                    {x.exige_aprovacao ? " · aprovação" : ""}
                  </div>
                </td>
                <td className="pequeno">
                  {x.frequencia === "diaria"
                    ? DIAS_SEMANA.filter((d) => x.dias_semana.includes(d.valor))
                        .map((d) => d.rotulo)
                        .join(", ")
                    : `Semanal, até ${PRAZOS[x.prazo_dias]?.toLowerCase()}`}
                </td>
                <td className="pequeno">
                  {nomeSetor.get(x.setor_id ?? "") ?? "—"}
                  <br />
                  {x.colaborador_padrao_id ? nomeColab.get(x.colaborador_padrao_id) : <em className="muted">definir no dia</em>}
                </td>
                <td>
                  <div className="linha">
                    <Link className="botao" href={`/admin/modelos?editar=${x.id}`}>
                      Editar
                    </Link>
                    <form action={alternarModelo}>
                      <input type="hidden" name="id" value={x.id} />
                      <input type="hidden" name="ativo" value={String(x.ativo)} />
                      <button className="botao">{x.ativo ? "Pausar" : "Reativar"}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {modelos.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Nenhuma tarefa recorrente ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
