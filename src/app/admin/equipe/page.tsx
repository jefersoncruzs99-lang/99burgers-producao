import { exigirGestor } from "@/lib/auth";
import type { Colaborador, Setor } from "@/lib/tipos";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { alternarColaborador, alternarSetor, criarSetor, salvarColaborador } from "../actions";

export default async function Equipe({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const [{ data: s, error }, { data: c }] = await Promise.all([
    supabase.from("prod_setores").select("*").order("nome"),
    supabase.from("prod_colaboradores").select("*").order("nome"),
  ]);
  const setores = (s ?? []) as Setor[];
  const colaboradores = (c ?? []) as Colaborador[];
  const ativos = setores.filter((x) => x.ativo);

  return (
    <>
      <h1>Equipe</h1>
      <p className="muted">
        Os colaboradores não precisam de login: no tablet eles tocam no próprio nome. Desative quem saiu da
        equipe (o histórico fica guardado).
      </p>
      <Mensagens erro={sp.erro ?? error?.message} ok={sp.ok} />

      <section className="cartao pilha">
        <h2>Colaboradores</h2>
        <form action={salvarColaborador} className="linha">
          <input name="nome" placeholder="Nome" required style={{ flex: "2 1 180px" }} aria-label="Nome" />
          <select name="setor_id" required style={{ flex: "1 1 160px" }} aria-label="Setor">
            <option value="">Setor</option>
            {ativos.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
          <button className="botao primario">Adicionar</button>
        </form>
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Setor</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.map((col) => (
                <tr key={col.id} style={{ opacity: col.ativo ? 1 : 0.5 }}>
                  <td colSpan={2}>
                    <form action={salvarColaborador} className="linha" style={{ flexWrap: "nowrap" }}>
                      <input type="hidden" name="id" value={col.id} />
                      <input name="nome" defaultValue={col.nome} required aria-label="Nome" />
                      <select name="setor_id" defaultValue={col.setor_id ?? ""} required aria-label="Setor">
                        {setores.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.nome}
                          </option>
                        ))}
                      </select>
                      <button className="botao">Salvar</button>
                    </form>
                  </td>
                  <td>
                    <form action={alternarColaborador}>
                      <input type="hidden" name="id" value={col.id} />
                      <input type="hidden" name="ativo" value={String(col.ativo)} />
                      <button className={`botao ${col.ativo ? "perigo" : ""}`}>
                        {col.ativo ? "Desativar" : "Reativar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {colaboradores.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    Nenhum colaborador ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cartao pilha">
        <h2>Setores</h2>
        <form action={criarSetor} className="linha">
          <input name="nome" placeholder="Novo setor" required style={{ flex: "1 1 180px" }} aria-label="Nome do setor" />
          <button className="botao">Criar setor</button>
        </form>
        {setores.map((x) => (
          <div key={x.id} className="linha entre" style={{ opacity: x.ativo ? 1 : 0.5 }}>
            <span>
              <strong>{x.nome}</strong> <span className="muted pequeno">{x.descricao}</span>
            </span>
            <form action={alternarSetor}>
              <input type="hidden" name="id" value={x.id} />
              <input type="hidden" name="ativo" value={String(x.ativo)} />
              <button className="botao">{x.ativo ? "Desativar" : "Reativar"}</button>
            </form>
          </div>
        ))}
      </section>
    </>
  );
}
