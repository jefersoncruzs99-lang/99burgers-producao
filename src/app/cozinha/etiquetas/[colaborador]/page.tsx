import Link from "next/link";
import { redirect } from "next/navigation";
import { rpcCozinha } from "@/lib/cozinha";
import type { CatalogoEtiquetas, EquipeCozinha } from "@/lib/tipos";
import { EmissorEtiquetas } from "./EmissorEtiquetas";

export const dynamic = "force-dynamic";

export default async function EtiquetasDoColaborador({
  params,
  searchParams,
}: {
  params: Promise<{ colaborador: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { colaborador } = await params;
  const sp = await searchParams;

  let equipes: EquipeCozinha[];
  let catalogo: CatalogoEtiquetas;
  try {
    [equipes, catalogo] = await Promise.all([
      rpcCozinha<EquipeCozinha[]>("prod_cozinha_equipe"),
      rpcCozinha<CatalogoEtiquetas>("prod_cozinha_etiqueta_itens"),
    ]);
  } catch {
    redirect("/cozinha");
  }

  const pessoa = equipes
    .flatMap((s) => s.colaboradores.map((c) => ({ id: c.id, nome: c.nome, setor: s.nome })))
    .find((c) => c.id === colaborador);
  if (!pessoa) redirect("/cozinha/etiquetas");

  return (
    <main className="container pilha" style={{ maxWidth: 900 }}>
      <div className="linha entre">
        <Link href="/cozinha/etiquetas" className="botao grande">
          ← Trocar de pessoa
        </Link>
        <Link href="/cozinha" className="botao grande">
          Início
        </Link>
      </div>
      <div>
        <span className="marca">ETIQUETAS DE VALIDADE</span>
        <h1 style={{ fontSize: "1.8rem" }}>{pessoa.nome}, o que vai etiquetar?</h1>
      </div>
      <EmissorEtiquetas
        colaboradorId={pessoa.id}
        setor={pessoa.setor}
        itens={catalogo.itens}
        recentes={catalogo.recentes}
        produtoInicial={sp.produto ?? null}
        tarefaId={sp.tarefa ?? null}
      />
    </main>
  );
}
