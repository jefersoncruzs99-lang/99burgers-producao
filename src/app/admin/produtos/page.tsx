import Link from "next/link";
import { exigirGestor } from "@/lib/auth";
import type { Produto, Setor } from "@/lib/tipos";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { alternarProduto, salvarProduto } from "../actions";

export default async function Produtos({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const [{ data: p, error }, { data: s }, { data: f }] = await Promise.all([
    supabase.from("prod_produtos").select("*").order("nome"),
    supabase.from("prod_setores").select("*").order("nome"),
    supabase.from("prod_fichas_tecnicas").select("produto_id").eq("ativa", true),
  ]);
  const produtos = (p ?? []) as Produto[];
  const setores = (s ?? []) as Setor[];
  const nomeSetor = new Map(setores.map((x) => [x.id, x.nome]));
  const comFicha = new Set((f ?? []).map((x: { produto_id: string }) => x.produto_id));

  return (
    <>
      <h1>Produtos e fichas técnicas</h1>
      <p className="muted">
        Cada produto pode ter uma ficha técnica. Na cozinha, ao tocar no produto da tarefa, a receita aparece já
        recalculada para a quantidade do dia.
      </p>
      <Mensagens erro={sp.erro ?? error?.message} ok={sp.ok} />

      <form action={salvarProduto} className="cartao linha">
        <input name="nome" placeholder="Novo produto (ex.: Feijão)" required style={{ flex: "2 1 200px" }} aria-label="Nome" />
        <select name="setor_id" style={{ flex: "1 1 150px" }} aria-label="Setor">
          <option value="">Setor</option>
          {setores
            .filter((x) => x.ativo)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
        </select>
        <select name="unidade" defaultValue="kg" style={{ flex: "0 1 110px" }} aria-label="Unidade">
          {["kg", "g", "l", "ml", "un", "porção", "cuba"].map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <button className="botao primario">Adicionar</button>
      </form>

      <div className="cartao tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Setor</th>
              <th>Unidade</th>
              <th>Ficha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((x) => (
              <tr key={x.id} style={{ opacity: x.ativo ? 1 : 0.5 }}>
                <td>
                  <Link href={`/admin/produtos/${x.id}`}>
                    <strong>{x.nome}</strong>
                  </Link>
                </td>
                <td>{nomeSetor.get(x.setor_id ?? "") ?? "—"}</td>
                <td>{x.unidade}</td>
                <td>
                  {comFicha.has(x.id) ? (
                    <span className="etiqueta concluida">Com ficha</span>
                  ) : (
                    <span className="etiqueta atrasada">Sem ficha</span>
                  )}
                </td>
                <td>
                  <div className="linha">
                    <Link className="botao" href={`/admin/produtos/${x.id}`}>
                      Editar ficha
                    </Link>
                    <form action={alternarProduto}>
                      <input type="hidden" name="id" value={x.id} />
                      <input type="hidden" name="ativo" value={String(x.ativo)} />
                      <button className="botao">{x.ativo ? "Desativar" : "Reativar"}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {produtos.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhum produto ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
