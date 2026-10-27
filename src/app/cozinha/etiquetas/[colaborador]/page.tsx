import { redirect } from "next/navigation";

/** Endereço antigo: as etiquetas agora ficam em /etiquetas. */
export default async function EtiquetasAntigoColaborador({
  params,
  searchParams,
}: {
  params: Promise<{ colaborador: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { colaborador } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams({ de: "cozinha" });
  if (sp.produto) q.set("produto", sp.produto);
  if (sp.tarefa) q.set("tarefa", sp.tarefa);
  redirect(`/etiquetas/${encodeURIComponent(colaborador)}?${q.toString()}`);
}
