import Link from "next/link";
import { codigoCozinha, rpcCozinha } from "@/lib/cozinha";
import { dataLonga, hojeISO } from "@/lib/datas";
import type { EquipeCozinha } from "@/lib/tipos";
import { FormCodigo } from "./FormCodigo";

export const dynamic = "force-dynamic";

export default async function Cozinha({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const codigo = await codigoCozinha();

  let equipes: EquipeCozinha[] | null = null;
  let erro: string | null = null;
  if (codigo) {
    try {
      equipes = await rpcCozinha<EquipeCozinha[]>("prod_cozinha_equipe");
    } catch (e) {
      if (!(e instanceof Error && e.message === "SEM_CODIGO")) {
        erro = "Não foi possível carregar a equipe. Verifique a internet do tablet.";
      }
    }
  }

  if (!equipes) {
    return (
      <main className="container pilha" style={{ maxWidth: 460, paddingTop: 48 }}>
        <h1>
          <span className="marca">NOVE NOVE BURGERS</span>
          <br />
          Cozinha
        </h1>
        {erro && <div className="erro">{erro}</div>}
        {codigo && !erro && <div className="aviso">O código mudou. Digite o novo código.</div>}
        <FormCodigo />
      </main>
    );
  }

  const comPessoas = equipes.filter((s) => s.colaboradores.length > 0);
  const setorEscolhido = comPessoas.find((s) => s.id === sp.setor);
  const visiveis = setorEscolhido ? [setorEscolhido] : comPessoas;

  return (
    <main className="container pilha">
      <div className="linha entre">
        <div>
          <span className="marca">NOVE NOVE BURGERS</span>
          <h1 style={{ textTransform: "capitalize" }}>{dataLonga(hojeISO())}</h1>
        </div>
      </div>

      {comPessoas.length > 1 && (
        <div className="linha">
          <Link href="/cozinha" className={`botao grande ${!setorEscolhido ? "primario" : ""}`}>
            Todos
          </Link>
          {comPessoas.map((s) => (
            <Link
              key={s.id}
              href={`/cozinha?setor=${s.id}`}
              className={`botao grande ${setorEscolhido?.id === s.id ? "primario" : ""}`}
            >
              {s.nome}
            </Link>
          ))}
        </div>
      )}

      {comPessoas.length === 0 && (
        <div className="aviso">Nenhum colaborador cadastrado ainda. Peça para a líder cadastrar a equipe.</div>
      )}

      {visiveis.map((s) => (
        <section key={s.id} className="pilha">
          <h2 style={{ fontSize: "1.5rem" }}>{s.nome}</h2>
          <p className="muted">Toque no seu nome para ver o que você vai fazer hoje.</p>
          <div className="nomes">
            {s.colaboradores.map((c) => (
              <Link key={c.id} href={`/cozinha/${c.id}`} className="nome-botao">
                {c.nome}
                <span className="contador">
                  {c.pendentes > 0 ? `${c.pendentes} tarefa${c.pendentes > 1 ? "s" : ""}` : "Tudo feito ✓"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
