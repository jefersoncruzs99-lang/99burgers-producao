import { exigirGestor } from "@/lib/auth";
import { dataCurta } from "@/lib/datas";
import { formatarQtd } from "@/lib/receita";
import type { Tarefa } from "@/lib/tipos";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { avaliarTarefa } from "../actions";

export default async function Aprovacoes({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();

  const { data: tarefasR, error } = await supabase
    .from("prod_tarefas")
    .select("*")
    .eq("status", "aguardando_aprovacao")
    .order("conclusao_real");
  const tarefas = (tarefasR ?? []) as Tarefa[];

  const ids = tarefas.map((t) => t.id);
  const [{ data: evid }, { data: colabs }] = await Promise.all([
    ids.length
      ? supabase.from("prod_evidencias").select("tarefa_id, caminho_arquivo").in("tarefa_id", ids)
      : Promise.resolve({ data: [] as { tarefa_id: string; caminho_arquivo: string }[] }),
    supabase.from("prod_colaboradores").select("id, nome"),
  ]);
  const nome = new Map((colabs ?? []).map((c: { id: string; nome: string }) => [c.id, c.nome]));

  // Links temporários (1 hora) para ver as fotos privadas.
  const fotos = new Map<string, string[]>();
  const caminhos = (evid ?? []).map((e) => e.caminho_arquivo);
  if (caminhos.length) {
    const { data: assinadas } = await supabase.storage.from("prod-evidencias").createSignedUrls(caminhos, 3600);
    (evid ?? []).forEach((e, i) => {
      const url = assinadas?.[i]?.signedUrl;
      if (url) fotos.set(e.tarefa_id, [...(fotos.get(e.tarefa_id) ?? []), url]);
    });
  }

  return (
    <>
      <h1>Aprovações</h1>
      <Mensagens erro={sp.erro ?? error?.message} ok={sp.ok} />
      {tarefas.length === 0 && <p className="muted">Nada aguardando aprovação. 👍</p>}
      <div className="grade">
        {tarefas.map((t) => (
          <article key={t.id} className="cartao pilha destaque">
            <strong>{t.titulo}</strong>
            <div className="muted pequeno">
              {nome.get(t.colaborador_id ?? "") ?? "—"} · dia {dataCurta(t.data_execucao)}
              {t.quantidade_realizada !== null && <> · feito {formatarQtd(t.quantidade_realizada, t.unidade)}</>}
            </div>
            {t.observacoes && <p>“{t.observacoes}”</p>}
            {(fotos.get(t.id) ?? []).map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Foto de ${t.titulo}`} className="foto-previa" />
              </a>
            ))}
            {t.exige_foto && !fotos.has(t.id) && <p className="muted pequeno">Foto não encontrada.</p>}
            <form action={avaliarTarefa} className="pilha">
              <input type="hidden" name="id" value={t.id} />
              <button name="decisao" value="aprovar" className="botao sucesso">
                Aprovar
              </button>
              <input name="motivo" placeholder="Motivo para refazer (se reprovar)" aria-label="Motivo" />
              <button name="decisao" value="reprovar" className="botao perigo">
                Devolver para refazer
              </button>
            </form>
          </article>
        ))}
      </div>
    </>
  );
}
