import Link from "next/link";
import { redirect } from "next/navigation";
import { rpcCozinha } from "@/lib/cozinha";
import { ajustarFicha, formatarQtd } from "@/lib/receita";
import type { FichaCozinha } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function Ficha({
  params,
  searchParams,
}: {
  params: Promise<{ produto: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { produto } = await params;
  const sp = await searchParams;

  let ficha: FichaCozinha | null;
  try {
    ficha = await rpcCozinha<FichaCozinha | null>("prod_cozinha_ficha", { p_produto: produto });
  } catch {
    redirect("/cozinha");
  }

  const volta = /^[0-9a-f-]{36}$/i.test(sp.volta ?? "") ? `/cozinha/${sp.volta}` : "/cozinha";
  if (!ficha) {
    return (
      <main className="container pilha" style={{ maxWidth: 760 }}>
        <Link href={volta} className="botao grande" style={{ alignSelf: "flex-start" }}>
          ← Voltar
        </Link>
        <div className="aviso">Este produto ainda não tem ficha técnica cadastrada.</div>
      </main>
    );
  }

  const qtd = sp.qtd ? Number(sp.qtd) : null;
  const ajuste = ajustarFicha(
    {
      rendimento: Number(ficha.rendimento),
      unidade_rendimento: ficha.unidade_rendimento,
      ingredientes: ficha.ingredientes.map((i) => ({ ...i, quantidade: Number(i.quantidade) })),
    },
    Number.isFinite(qtd) ? qtd : null,
    sp.un || null,
  );

  return (
    <main className="container pilha" style={{ maxWidth: 760 }}>
      <Link href={volta} className="botao grande" style={{ alignSelf: "flex-start" }}>
        ← Voltar às tarefas
      </Link>
      <div>
        <span className="marca">FICHA TÉCNICA · v{ficha.versao}</span>
        <h1 style={{ fontSize: "2rem" }}>{ficha.produto}</h1>
      </div>

      <div className="cartao destaque">
        {ajuste.ajustada ? (
          <>
            <div className="muted">Receita ajustada para fazer</div>
            <div className="qtd">{formatarQtd(qtd, sp.un || ficha.unidade_rendimento)}</div>
            <div className="muted pequeno">
              (a receita original rende {formatarQtd(Number(ficha.rendimento), ficha.unidade_rendimento)} — tudo
              multiplicado por {formatarQtd(ajuste.fator)})
            </div>
          </>
        ) : (
          <>
            <div className="muted">Esta receita rende</div>
            <div className="qtd">{formatarQtd(Number(ficha.rendimento), ficha.unidade_rendimento)}</div>
          </>
        )}
      </div>
      {ajuste.aviso && <div className="aviso">{ajuste.aviso}</div>}

      <section className="cartao">
        <h2>Ingredientes</h2>
        <ul className="ingredientes">
          {ajuste.ingredientes.map((i, idx) => (
            <li key={idx}>
              <span>{i.nome}</span>
              <strong style={{ color: "var(--amarelo)", whiteSpace: "nowrap" }}>{formatarQtd(i.quantidade, i.unidade)}</strong>
            </li>
          ))}
          {ajuste.ingredientes.length === 0 && <li className="muted">Sem ingredientes cadastrados.</li>}
        </ul>
      </section>

      {ficha.modo_preparo && (
        <section className="cartao">
          <h2>Modo de preparo</h2>
          <div className="preparo">{ficha.modo_preparo}</div>
        </section>
      )}
      {ficha.armazenamento && (
        <section className="cartao">
          <h2>Armazenamento</h2>
          <div className="preparo">{ficha.armazenamento}</div>
        </section>
      )}
    </main>
  );
}
