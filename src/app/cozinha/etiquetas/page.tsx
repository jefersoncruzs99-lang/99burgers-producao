import Link from "next/link";
import { redirect } from "next/navigation";
import { rpcCozinha } from "@/lib/cozinha";
import type { EquipeCozinha } from "@/lib/tipos";

export const dynamic = "force-dynamic";

/** Primeiro passo das etiquetas: quem está imprimindo (vai como responsável na etiqueta). */
export default async function EtiquetasQuem() {
  let equipes: EquipeCozinha[];
  try {
    equipes = await rpcCozinha<EquipeCozinha[]>("prod_cozinha_equipe");
  } catch {
    redirect("/cozinha");
  }
  const comPessoas = equipes.filter((s) => s.colaboradores.length > 0);

  return (
    <main className="container pilha" style={{ maxWidth: 820 }}>
      <Link href="/cozinha" className="botao grande" style={{ alignSelf: "flex-start" }}>
        ← Voltar
      </Link>
      <div>
        <span className="marca">ETIQUETAS DE VALIDADE</span>
        <h1 style={{ fontSize: "1.8rem" }}>Quem está etiquetando?</h1>
        <p className="muted">Seu nome sai na etiqueta como responsável.</p>
      </div>
      {comPessoas.length === 0 && <div className="aviso">Nenhum colaborador cadastrado ainda.</div>}
      {comPessoas.map((s) => (
        <section key={s.id} className="pilha">
          <h2>{s.nome}</h2>
          <div className="nomes">
            {s.colaboradores.map((c) => (
              <Link key={c.id} href={`/cozinha/etiquetas/${c.id}`} className="nome-botao">
                {c.nome}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
