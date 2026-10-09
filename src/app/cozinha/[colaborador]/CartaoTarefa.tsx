"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Status } from "@/components/Status";
import { dataCurta } from "@/lib/datas";
import { formatarQtd } from "@/lib/receita";
import type { TarefaCozinha } from "@/lib/tipos";
import { concluirTarefa, iniciarTarefa, type EstadoTarefa } from "../actions";
import { EnvioFoto } from "./EnvioFoto";

export function CartaoTarefa({ tarefa: t, colaboradorId }: { tarefa: TarefaCozinha; colaboradorId: string }) {
  const [concluindo, setConcluindo] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [estado, acao, enviando] = useActionState<EstadoTarefa, FormData>(concluirTarefa, {});
  const entregue = t.status === "concluida" || t.status === "aguardando_aprovacao";

  const fichaHref =
    t.produto_id && t.tem_ficha
      ? `/cozinha/ficha/${t.produto_id}?qtd=${t.quantidade_planejada ?? ""}&un=${encodeURIComponent(t.unidade ?? "")}&volta=${colaboradorId}`
      : null;

  return (
    <article
      className={`cartao tarefa ${t.atrasada || t.status === "reprovada" ? "alerta" : ""} ${t.status === "em_andamento" ? "destaque" : ""}`}
      style={entregue ? { opacity: 0.6 } : undefined}
    >
      <div className="linha entre">
        <span className="titulo">{t.titulo}</span>
        <Status status={t.status} atrasada={t.atrasada} />
      </div>

      {t.quantidade_planejada !== null && <div className="qtd">{formatarQtd(t.quantidade_planejada, t.unidade)}</div>}

      <div className="muted">
        {t.semanal
          ? `Prazo: até ${dataCurta(t.janela_fim)}`
          : t.atrasada
            ? `Era para ${dataCurta(t.janela_fim ?? t.data_execucao)}`
            : "Hoje"}
        {t.duracao_estimada_min ? ` · ~${t.duracao_estimada_min} min` : ""}
        {t.exige_foto ? " · 📷 precisa de foto" : ""}
      </div>

      {t.status === "reprovada" && t.motivo_reprovacao && (
        <div className="erro">
          <strong>Refazer:</strong> {t.motivo_reprovacao}
        </div>
      )}
      {t.instrucoes && <p className="preparo">{t.instrucoes}</p>}

      {fichaHref && (
        <Link href={fichaHref} className="botao grande cheio">
          📋 Ver receita de {t.produto_nome}
          {t.quantidade_planejada ? ` (${formatarQtd(t.quantidade_planejada, t.unidade)})` : ""}
        </Link>
      )}

      {!entregue && !concluindo && (
        <div className="linha">
          {(t.status === "pendente" || t.status === "reprovada") && !t.atrasada && (
            <form action={iniciarTarefa} style={{ flex: 1 }}>
              <input type="hidden" name="colaborador_id" value={colaboradorId} />
              <input type="hidden" name="tarefa_id" value={t.id} />
              <button className="botao grande cheio">▶ Comecei</button>
            </form>
          )}
          <button className="botao primario grande" style={{ flex: 1 }} onClick={() => setConcluindo(true)}>
            ✓ Terminei
          </button>
        </div>
      )}

      {!entregue && concluindo && (
        <form action={acao} className="pilha">
          <input type="hidden" name="colaborador_id" value={colaboradorId} />
          <input type="hidden" name="tarefa_id" value={t.id} />
          <input type="hidden" name="foto" value={foto ?? ""} />
          {t.quantidade_planejada !== null && (
            <div className="campo">
              <label htmlFor={`q-${t.id}`}>Quanto você fez? ({t.unidade ?? ""})</label>
              <input
                id={`q-${t.id}`}
                name="quantidade"
                inputMode="decimal"
                defaultValue={String(t.quantidade_planejada)}
                style={{ fontSize: "1.3rem" }}
              />
            </div>
          )}
          <div className="campo">
            <label htmlFor={`o-${t.id}`}>Alguma observação? (opcional)</label>
            <input id={`o-${t.id}`} name="observacoes" placeholder="Ex.: faltou cebola" />
          </div>
          <EnvioFoto tarefaId={t.id} obrigatoria={t.exige_foto} aoEnviar={setFoto} />
          {estado.erro && <div className="erro">{estado.erro}</div>}
          <div className="linha">
            <button type="button" className="botao grande" onClick={() => setConcluindo(false)}>
              Voltar
            </button>
            <button
              className="botao sucesso grande"
              style={{ flex: 1 }}
              disabled={enviando || (t.exige_foto && !foto)}
            >
              {enviando ? "Enviando..." : "Confirmar entrega"}
            </button>
          </div>
        </form>
      )}

      {estado.ok && <div className="ok">{estado.ok}</div>}
    </article>
  );
}
