import Link from "next/link";
import { redirect } from "next/navigation";
import { rpcCozinha } from "@/lib/cozinha";
import { dataCurta } from "@/lib/datas";
import { formatarQtd } from "@/lib/receita";
import type { ContagemSemana, EquipeCozinha } from "@/lib/tipos";
import { FormContagem } from "@/components/FormContagem";
import { salvarContagemCozinha } from "../actions";

export const dynamic = "force-dynamic";

export default async function ContagemCozinha() {
  let contagem: ContagemSemana;
  let equipes: EquipeCozinha[];
  try {
    [contagem, equipes] = await Promise.all([
      rpcCozinha<ContagemSemana>("prod_cozinha_contagem"),
      rpcCozinha<EquipeCozinha[]>("prod_cozinha_equipe"),
    ]);
  } catch {
    redirect("/cozinha");
  }
  const pessoas = equipes.flatMap((s) => s.colaboradores.map((c) => ({ id: c.id, nome: c.nome })));
  const confirmada = contagem.status === "confirmada";
  const aProduzir = contagem.itens.filter((i) => i.a_produzir !== null && Number(i.a_produzir) > 0);

  return (
    <main className="container pilha" style={{ maxWidth: 820 }}>
      <Link href="/cozinha" className="botao grande" style={{ alignSelf: "flex-start" }}>
        ← Voltar
      </Link>
      <div>
        <span className="marca">CONTAGEM DE ESTOQUE</span>
        <h1 style={{ fontSize: "1.8rem" }}>Semana de {dataCurta(contagem.semana)}</h1>
        <p className="muted">Conte quanto tem de cada produto e digite abaixo. O sistema calcula o que precisa produzir.</p>
      </div>

      {confirmada && (
        <div className="ok pilha">
          <strong>
            Contagem confirmada{contagem.contado_por ? ` por ${contagem.contado_por}` : ""}
            {contagem.confirmada_em
              ? ` em ${new Date(contagem.confirmada_em).toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" })}`
              : ""}
            .
          </strong>
          {aProduzir.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {aProduzir.map((i) => (
                <li key={i.produto_id}>
                  {i.produto}: produzir <strong>{formatarQtd(Number(i.a_produzir), i.unidade)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <span>Estoque em dia, nada para produzir.</span>
          )}
          <span className="pequeno">Se precisar corrigir algum número, ajuste abaixo e confirme de novo.</span>
        </div>
      )}

      {contagem.itens.length === 0 ? (
        <div className="aviso">Ainda não há produtos com meta de estoque. Peça para a líder cadastrar.</div>
      ) : (
        <FormContagem itens={contagem.itens} acao={salvarContagemCozinha} pessoas={pessoas} grande />
      )}
    </main>
  );
}
