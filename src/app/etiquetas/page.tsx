import Link from "next/link";
import { codigoCozinha, rpcCozinha } from "@/lib/cozinha";
import type { EquipeCozinha } from "@/lib/tipos";
import { FormCodigo } from "../cozinha/FormCodigo";

export const dynamic = "force-dynamic";

/** App de etiquetas: quem está imprimindo (vai como responsável na etiqueta). */
export default async function EtiquetasQuem({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const daCozinha = sp.de === "cozinha";
  const codigo = await codigoCozinha();

  let equipes: EquipeCozinha[] | null = null;
  let erro: string | null = null;
  if (codigo) {
    try {
      equipes = await rpcCozinha<EquipeCozinha[]>("prod_cozinha_equipe_etiquetas");
    } catch (e) {
      if (!(e instanceof Error && e.message === "SEM_CODIGO")) {
        erro = "Não foi possível carregar a equipe. Verifique a internet do aparelho.";
      }
    }
  }

  if (!equipes) {
    return (
      <main className="container pilha" style={{ maxWidth: 460, paddingTop: 48 }}>
        <h1>
          <span className="marca">NOVE NOVE BURGERS</span>
          <br />
          Etiquetas
        </h1>
        {erro && <div className="erro">{erro}</div>}
        {codigo && !erro && <div className="aviso">O código mudou. Digite o novo código.</div>}
        <FormCodigo destino="/etiquetas" />
      </main>
    );
  }

  const comPessoas = equipes.filter((s) => s.colaboradores.length > 0);
  const sufixo = daCozinha ? "?de=cozinha" : "";

  return (
    <main className="container pilha" style={{ maxWidth: 900 }}>
      {daCozinha && (
        <Link href="/cozinha" className="botao grande" style={{ alignSelf: "flex-start" }}>
          ← Voltar para as tarefas
        </Link>
      )}
      <div>
        <span className="marca">ETIQUETAS DE VALIDADE</span>
        <h1 style={{ fontSize: "1.8rem" }}>Quem está etiquetando?</h1>
        <p className="muted">Seu nome sai na etiqueta como responsável.</p>
      </div>
      {comPessoas.length === 0 && <div className="aviso">Nenhum colaborador cadastrado para etiquetas ainda.</div>}
      {comPessoas.map((s) => (
        <section key={s.id} className="pilha">
          <h2>{s.nome}</h2>
          <div className="nomes">
            {s.colaboradores.map((c) => (
              <Link key={c.id} href={`/etiquetas/${c.id}${sufixo}`} className="nome-botao">
                {c.nome}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
