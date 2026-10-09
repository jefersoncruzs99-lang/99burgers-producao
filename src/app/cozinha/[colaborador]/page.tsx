import Link from "next/link";
import { redirect } from "next/navigation";
import { rpcCozinha } from "@/lib/cozinha";
import { dataLonga, hojeISO } from "@/lib/datas";
import type { EquipeCozinha, TarefaCozinha } from "@/lib/tipos";
import { CartaoTarefa } from "./CartaoTarefa";

export const dynamic = "force-dynamic";

export default async function TarefasDoColaborador({ params }: { params: Promise<{ colaborador: string }> }) {
  const { colaborador } = await params;

  let equipes: EquipeCozinha[];
  let tarefas: TarefaCozinha[];
  try {
    equipes = await rpcCozinha<EquipeCozinha[]>("prod_cozinha_equipe");
    tarefas = await rpcCozinha<TarefaCozinha[]>("prod_cozinha_tarefas", { p_colaborador: colaborador });
  } catch {
    redirect("/cozinha");
  }

  const pessoa = equipes.flatMap((s) => s.colaboradores.map((c) => ({ ...c, setor: s.nome }))).find((c) => c.id === colaborador);
  if (!pessoa) redirect("/cozinha");

  const abertas = tarefas.filter((t) => t.status !== "concluida" && t.status !== "aguardando_aprovacao");
  const entregues = tarefas.filter((t) => t.status === "concluida" || t.status === "aguardando_aprovacao");
  const doDia = abertas.filter((t) => !t.semanal);
  const daSemana = abertas.filter((t) => t.semanal);
  const minutos = abertas.reduce((s, t) => s + (t.duracao_estimada_min ?? 0), 0);

  return (
    <main className="container pilha" style={{ maxWidth: 820 }}>
      <Link href="/cozinha" className="botao grande" style={{ alignSelf: "flex-start" }}>
        ← Trocar de pessoa
      </Link>
      <div>
        <h1 style={{ fontSize: "1.9rem" }}>Olá, {pessoa.nome}!</h1>
        <p className="muted" style={{ textTransform: "capitalize" }}>
          {pessoa.setor} · {dataLonga(hojeISO())}
          {minutos > 0 && <span style={{ textTransform: "none" }}> · cerca de {Math.round(minutos)} min de trabalho</span>}
        </p>
      </div>

      {abertas.length === 0 && (
        <div className="ok" style={{ fontSize: "1.2rem" }}>
          Tudo entregue por hoje! 🎉
        </div>
      )}

      {doDia.length > 0 && (
        <section className="pilha">
          <h2>Para hoje</h2>
          {doDia.map((t) => (
            <CartaoTarefa key={t.id} tarefa={t} colaboradorId={colaborador} />
          ))}
        </section>
      )}

      {daSemana.length > 0 && (
        <section className="pilha">
          <h2>Da semana</h2>
          <p className="muted pequeno">Você tem até o prazo para fazer. Quando terminar, marque como feita.</p>
          {daSemana.map((t) => (
            <CartaoTarefa key={t.id} tarefa={t} colaboradorId={colaborador} />
          ))}
        </section>
      )}

      {entregues.length > 0 && (
        <section className="pilha">
          <h2>Entregues</h2>
          {entregues.map((t) => (
            <CartaoTarefa key={t.id} tarefa={t} colaboradorId={colaborador} />
          ))}
        </section>
      )}
    </main>
  );
}
