import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirGestor } from "@/lib/auth";
import type { Produto, Setor } from "@/lib/tipos";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { salvarProduto } from "../../actions";
import { EditorFicha } from "./EditorFicha";

export default async function ProdutoDetalhe({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ParamsPagina;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await exigirGestor();

  const { data: p } = await supabase.from("prod_produtos").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const produto = p as Produto;

  const [{ data: s }, { data: fichas }] = await Promise.all([
    supabase.from("prod_setores").select("*").order("nome"),
    supabase
      .from("prod_fichas_tecnicas")
      .select("*, prod_ficha_ingredientes(nome, quantidade, unidade, ordem)")
      .eq("produto_id", id)
      .order("versao", { ascending: false }),
  ]);
  const setores = (s ?? []) as Setor[];
  type FichaComIngr = {
    id: string;
    versao: number;
    ativa: boolean;
    rendimento: number;
    unidade_rendimento: string;
    modo_preparo: string | null;
    armazenamento: string | null;
    created_at: string;
    prod_ficha_ingredientes: { nome: string; quantidade: number; unidade: string; ordem: number }[];
  };
  const lista = (fichas ?? []) as FichaComIngr[];
  const ativa = lista.find((f) => f.ativa) ?? null;

  return (
    <>
      <Link href="/admin/produtos" className="pequeno">
        ← Produtos
      </Link>
      <h1>{produto.nome}</h1>
      <Mensagens erro={sp.erro} ok={sp.ok} />

      <form action={salvarProduto} className="cartao pilha">
        <h2>Dados do produto</h2>
        <input type="hidden" name="id" value={produto.id} />
        <div className="campos">
          <div className="campo">
            <label htmlFor="nome">Nome</label>
            <input id="nome" name="nome" defaultValue={produto.nome} required />
          </div>
          <div className="campo">
            <label htmlFor="setor_id">Setor</label>
            <select id="setor_id" name="setor_id" defaultValue={produto.setor_id ?? ""}>
              <option value="">—</option>
              {setores.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="unidade">Unidade de produção</label>
            <input id="unidade" name="unidade" defaultValue={produto.unidade} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="descricao">Descrição</label>
          <textarea id="descricao" name="descricao" defaultValue={produto.descricao ?? ""} />
        </div>
        <button className="botao">Salvar produto</button>
      </form>

      <section className="cartao pilha destaque">
        <h2>Ficha técnica {ativa ? `(versão ${ativa.versao})` : ""}</h2>
        <p className="muted pequeno">
          Ao salvar, é criada uma nova versão. As versões anteriores ficam guardadas no histórico.
        </p>
        <EditorFicha
          produtoId={produto.id}
          unidadePadrao={produto.unidade}
          inicial={
            ativa
              ? {
                  rendimento: ativa.rendimento,
                  unidade_rendimento: ativa.unidade_rendimento,
                  modo_preparo: ativa.modo_preparo ?? "",
                  armazenamento: ativa.armazenamento ?? "",
                  ingredientes: [...ativa.prod_ficha_ingredientes]
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((i) => ({ nome: i.nome, quantidade: String(i.quantidade), unidade: i.unidade })),
                }
              : null
          }
        />
      </section>

      {lista.length > 1 && (
        <details className="cartao">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Histórico de versões</summary>
          <ul>
            {lista.map((f) => (
              <li key={f.id}>
                Versão {f.versao} · rende {f.rendimento} {f.unidade_rendimento} ·{" "}
                {new Date(f.created_at).toLocaleDateString("pt-BR")} {f.ativa ? "(em uso)" : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
