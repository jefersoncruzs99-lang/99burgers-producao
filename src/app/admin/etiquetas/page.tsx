import { exigirGestor } from "@/lib/auth";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { ROTULO_CONSERVACAO, ROTULO_TIPO, dataEtiqueta, horaEtiqueta, vencida } from "@/lib/etiqueta";
import type { EtiquetaEmitida, EtiquetaItemAdmin, Produto, TipoEtiqueta } from "@/lib/tipos";
import { alternarItemEtiqueta, salvarConfigEtiqueta, salvarItemEtiqueta } from "../actions";

const TIPOS: TipoEtiqueta[] = ["preparo", "aberto", "descongelado"];

export default async function EtiquetasAdmin({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const [{ data: i, error }, { data: p }, { data: c }, { data: r }] = await Promise.all([
    supabase.from("prod_etiqueta_itens").select("*").order("ordem").order("nome"),
    supabase.from("prod_produtos").select("id, nome, ativo").order("nome"),
    supabase.from("prod_etiqueta_config").select("empresa, cnpj").eq("id", "padrao").maybeSingle(),
    supabase.from("prod_etiquetas").select("*").order("created_at", { ascending: false }).limit(60),
  ]);
  const itens = (i ?? []) as EtiquetaItemAdmin[];
  const produtos = ((p ?? []) as Pick<Produto, "id" | "nome" | "ativo">[]).filter((x) => x.ativo);
  const recentes = (r ?? []) as EtiquetaEmitida[];
  const grupos = Array.from(new Set(itens.map((x) => x.grupo)));
  const config = (c ?? { empresa: "NOVE NOVE BURGER'S", cnpj: null }) as { empresa: string; cnpj: string | null };

  return (
    <>
      <h1>Etiquetas de validade</h1>
      <p className="muted">
        Prazos que o tablet usa para calcular o vencimento. Deixe em branco a conservação que não se aplica. Se todas
        ficarem em branco, o tablet pede o prazo da embalagem na hora de imprimir.
      </p>
      <Mensagens erro={sp.erro ?? error?.message} ok={sp.ok} />

      <form action={salvarConfigEtiqueta} className="cartao linha">
        <div className="campo" style={{ flex: "2 1 220px" }}>
          <label htmlFor="empresa">Nome na etiqueta</label>
          <input id="empresa" name="empresa" defaultValue={config.empresa} />
        </div>
        <div className="campo" style={{ flex: "1 1 200px" }}>
          <label htmlFor="cnpj">CNPJ</label>
          <input id="cnpj" name="cnpj" defaultValue={config.cnpj ?? ""} />
        </div>
        <button className="botao primario" style={{ alignSelf: "flex-end" }}>
          Salvar
        </button>
      </form>

      <datalist id="grupos-etiqueta">
        {grupos.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <section className="cartao pilha">
        <h2>Adicionar produto</h2>
        <FormItem produtos={produtos} />
      </section>

      {grupos.map((g) => (
        <section key={g} className="cartao pilha">
          <h2>{g}</h2>
          {itens
            .filter((x) => x.grupo === g)
            .map((x) => (
              <div key={x.id}>
                <FormItem item={x} produtos={produtos} />
                <form action={alternarItemEtiqueta} style={{ marginTop: -4, marginBottom: 6 }}>
                  <input type="hidden" name="id" value={x.id} />
                  <input type="hidden" name="ativo" value={String(x.ativo)} />
                  <button className="botao" style={{ minHeight: 30, padding: "4px 10px", fontSize: ".85rem" }}>
                    {x.ativo ? "Esconder do tablet" : "Mostrar no tablet"}
                  </button>
                  {x.base && <span className="muted pequeno" style={{ marginLeft: 10 }}>Base: {x.base}</span>}
                </form>
              </div>
            ))}
        </section>
      ))}

      <section className="cartao pilha">
        <h2>Últimas etiquetas impressas</h2>
        {recentes.length === 0 ? (
          <p className="muted">Nenhuma etiqueta impressa ainda.</p>
        ) : (
          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Produto</th>
                  <th>Conservação</th>
                  <th>Feita</th>
                  <th>Vence</th>
                  <th>Qtd</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((e) => (
                  <tr key={e.id}>
                    <td>{e.lote}</td>
                    <td>{e.nome}</td>
                    <td>{ROTULO_CONSERVACAO[e.conservacao]}</td>
                    <td>
                      {dataEtiqueta(e.manipulado_em)} {horaEtiqueta(e.manipulado_em)}
                    </td>
                    <td>
                      {dataEtiqueta(e.vence_em)}{" "}
                      {vencida(e) && <span className="etiqueta atrasada">vencida</span>}
                    </td>
                    <td>{e.quantidade}</td>
                    <td>{e.responsavel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function FormItem({ item, produtos }: { item?: EtiquetaItemAdmin; produtos: Pick<Produto, "id" | "nome">[] }) {
  const pre = item?.id ?? "novo";
  return (
    <form action={salvarItemEtiqueta} className={`item-admin ${item && !item.ativo ? "inativo" : ""}`}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="campo larg-2">
        <label htmlFor={`${pre}-nome`}>Produto</label>
        <input id={`${pre}-nome`} name="nome" defaultValue={item?.nome ?? ""} required />
      </div>
      <div className="campo">
        <label htmlFor={`${pre}-grupo`}>Grupo</label>
        <input id={`${pre}-grupo`} name="grupo" defaultValue={item?.grupo ?? ""} list="grupos-etiqueta" />
      </div>
      <div className="campo">
        <label htmlFor={`${pre}-tipo`}>Tipo</label>
        <select id={`${pre}-tipo`} name="tipo" defaultValue={item?.tipo ?? "preparo"}>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="campo larg-2">
        <label htmlFor={`${pre}-prod`}>Ligado à tarefa do produto (opcional)</label>
        <select id={`${pre}-prod`} name="produto_id" defaultValue={item?.produto_id ?? ""}>
          <option value="">Nenhum</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>
      <button className="botao primario">{item ? "Salvar" : "Adicionar"}</button>

      <div className="campo">
        <label htmlFor={`${pre}-dr`}>Resfriado (dias)</label>
        <input id={`${pre}-dr`} name="dias_resfriado" inputMode="numeric" defaultValue={item?.dias_resfriado ?? ""} />
      </div>
      <div className="campo">
        <label htmlFor={`${pre}-tr`}>Temp. resfriado</label>
        <input id={`${pre}-tr`} name="temperatura_resfriado" defaultValue={item?.temperatura_resfriado ?? "Máximo 4 °C"} />
      </div>
      <div className="campo">
        <label htmlFor={`${pre}-dc`}>Congelado (dias)</label>
        <input id={`${pre}-dc`} name="dias_congelado" inputMode="numeric" defaultValue={item?.dias_congelado ?? ""} />
      </div>
      <div className="campo">
        <label htmlFor={`${pre}-tc`}>Temp. congelado</label>
        <input id={`${pre}-tc`} name="temperatura_congelado" defaultValue={item?.temperatura_congelado ?? "Abaixo de -18 °C"} />
      </div>
      <div className="campo">
        <label htmlFor={`${pre}-da`}>Ambiente (dias)</label>
        <input id={`${pre}-da`} name="dias_ambiente" inputMode="numeric" defaultValue={item?.dias_ambiente ?? ""} />
      </div>
      <div className="campo">
        <label htmlFor={`${pre}-ta`}>Temp. ambiente</label>
        <input id={`${pre}-ta`} name="temperatura_ambiente" defaultValue={item?.temperatura_ambiente ?? "Ambiente"} />
      </div>
      <div className="campo larg-tudo">
        <label htmlFor={`${pre}-obs`}>Aviso para a cozinha (opcional)</label>
        <input id={`${pre}-obs`} name="observacao" defaultValue={item?.observacao ?? ""} />
      </div>
    </form>
  );
}
