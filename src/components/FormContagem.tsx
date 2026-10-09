"use client";

import { useActionState, useState } from "react";
import { aProduzir, lerQuantidade } from "@/lib/estoque";
import { formatarQtd } from "@/lib/receita";
import type { ItemContagem } from "@/lib/tipos";

export type EstadoContagem = { erro?: string; ok?: string };

export function FormContagem({
  itens,
  acao,
  pessoas,
  grande = false,
}: {
  itens: ItemContagem[];
  acao: (anterior: EstadoContagem, fd: FormData) => Promise<EstadoContagem>;
  pessoas?: { id: string; nome: string }[];
  grande?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoContagem, FormData>(acao, {});
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(itens.map((i) => [i.produto_id, i.quantidade === null ? "" : String(i.quantidade)])),
  );
  const faltam = itens.filter((i) => lerQuantidade(valores[i.produto_id] ?? "") === null).length;
  const tam = grande ? { fontSize: "1.3rem", minHeight: 56 } : undefined;

  return (
    <form action={enviar} className="pilha">
      {pessoas && (
        <div className="campo">
          <label htmlFor="colaborador_id">Quem está contando?</label>
          <select id="colaborador_id" name="colaborador_id" required style={tam}>
            <option value="">Escolha seu nome</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="pilha">
        {itens.map((i) => {
          const contado = lerQuantidade(valores[i.produto_id] ?? "");
          const produzir = aProduzir(Number(i.meta), contado, i.produz_semana);
          return (
            <div key={i.produto_id} className="cartao" style={{ padding: 12, background: "var(--preto)" }}>
              <input type="hidden" name="produto_id" value={i.produto_id} />
              <div className="linha entre" style={{ alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 180px" }}>
                  <strong style={grande ? { fontSize: "1.2rem" } : undefined}>{i.produto}</strong>
                  <div className="muted pequeno">
                    Meta {formatarQtd(Number(i.meta), i.unidade)} · {i.ciclo === "semanal" ? "semanal" : "quinzenal"}
                    {!i.produz_semana && " · não produz nesta semana"}
                  </div>
                </div>
                <div className="campo" style={{ flex: "0 1 150px" }}>
                  <label htmlFor={`q-${i.produto_id}`} className="pequeno">
                    Tem ({i.unidade})
                  </label>
                  <input
                    id={`q-${i.produto_id}`}
                    name={`q_${i.produto_id}`}
                    inputMode="decimal"
                    value={valores[i.produto_id] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [i.produto_id]: e.target.value }))}
                    style={tam}
                  />
                </div>
              </div>
              {contado !== null && (
                <div className="pequeno" style={{ marginTop: 6 }}>
                  {produzir > 0 ? (
                    <span style={{ color: "var(--amarelo)", fontWeight: 700 }}>
                      Produzir {formatarQtd(produzir, i.unidade)}
                    </span>
                  ) : (
                    <span className="muted">{i.produz_semana ? "Estoque ok, não precisa produzir" : "Só contagem"}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {estado.erro && <div className="erro">{estado.erro}</div>}
      {estado.ok && <div className="ok">{estado.ok}</div>}

      <div className="linha">
        <button
          name="confirmar"
          value="nao"
          className={`botao ${grande ? "grande" : ""}`}
          disabled={enviando}
          style={{ flex: 1 }}
        >
          Salvar e continuar depois
        </button>
        <button
          name="confirmar"
          value="sim"
          className={`botao primario ${grande ? "grande" : ""}`}
          disabled={enviando || faltam > 0}
          style={{ flex: 2 }}
        >
          {enviando ? "Enviando..." : faltam > 0 ? `Faltam ${faltam} para contar` : "✓ Confirmar contagem"}
        </button>
      </div>
      <p className="muted pequeno">
        Ao confirmar, o sistema calcula meta − estoque e cria (ou ajusta) as tarefas de produção da semana para cada
        responsável.
      </p>
    </form>
  );
}

