"use client";

import { useState } from "react";
import { salvarFicha } from "../../actions";

type Linha = { nome: string; quantidade: string; unidade: string };

const UNIDADES = ["kg", "g", "l", "ml", "un", "colher", "xícara", "pitada", "dente", "maço"];

export function EditorFicha({
  produtoId,
  unidadePadrao,
  inicial,
}: {
  produtoId: string;
  unidadePadrao: string;
  inicial: {
    rendimento: number;
    unidade_rendimento: string;
    modo_preparo: string;
    armazenamento: string;
    ingredientes: Linha[];
  } | null;
}) {
  const [linhas, setLinhas] = useState<Linha[]>(
    inicial?.ingredientes.length ? inicial.ingredientes : [{ nome: "", quantidade: "", unidade: "kg" }],
  );

  const mudar = (i: number, campo: keyof Linha, valor: string) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  return (
    <form action={salvarFicha} className="pilha">
      <input type="hidden" name="produto_id" value={produtoId} />
      <div className="campos">
        <div className="campo">
          <label htmlFor="rendimento">A receita rende</label>
          <input
            id="rendimento"
            name="rendimento"
            inputMode="decimal"
            required
            defaultValue={inicial ? String(inicial.rendimento) : ""}
            placeholder="Ex.: 1"
          />
        </div>
        <div className="campo">
          <label htmlFor="unidade_rendimento">Unidade do rendimento</label>
          <select
            id="unidade_rendimento"
            name="unidade_rendimento"
            defaultValue={inicial?.unidade_rendimento ?? unidadePadrao}
          >
            {Array.from(new Set([unidadePadrao, "kg", "g", "l", "ml", "un", "porção", "cuba"])).map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="pilha">
        <strong>Ingredientes</strong>
        {linhas.map((l, i) => (
          <div key={i} className="linha" style={{ flexWrap: "nowrap" }}>
            <input
              name="ing_nome"
              value={l.nome}
              onChange={(e) => mudar(i, "nome", e.target.value)}
              placeholder="Ingrediente"
              aria-label={`Ingrediente ${i + 1}`}
              style={{ flex: 3 }}
            />
            <input
              name="ing_qtd"
              value={l.quantidade}
              onChange={(e) => mudar(i, "quantidade", e.target.value)}
              inputMode="decimal"
              placeholder="Qtd"
              aria-label={`Quantidade do ingrediente ${i + 1}`}
              style={{ flex: 1, minWidth: 70 }}
            />
            <select
              name="ing_un"
              value={l.unidade}
              onChange={(e) => mudar(i, "unidade", e.target.value)}
              aria-label={`Unidade do ingrediente ${i + 1}`}
              style={{ flex: 1, minWidth: 80 }}
            >
              {Array.from(new Set([l.unidade, ...UNIDADES])).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <button
              type="button"
              className="botao perigo"
              aria-label={`Remover ingrediente ${i + 1}`}
              onClick={() => setLinhas((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="botao"
          onClick={() => setLinhas((ls) => [...ls, { nome: "", quantidade: "", unidade: "kg" }])}
        >
          + Ingrediente
        </button>
      </div>

      <div className="campo">
        <label htmlFor="modo_preparo">Modo de preparo</label>
        <textarea
          id="modo_preparo"
          name="modo_preparo"
          rows={8}
          defaultValue={inicial?.modo_preparo ?? ""}
          placeholder={"1. Deixe o feijão de molho...\n2. ..."}
        />
      </div>
      <div className="campo">
        <label htmlFor="armazenamento">Armazenamento</label>
        <textarea
          id="armazenamento"
          name="armazenamento"
          rows={3}
          defaultValue={inicial?.armazenamento ?? ""}
          placeholder="Ex.: Resfriar e guardar em cuba tampada, até 3 dias refrigerado."
        />
      </div>
      <button className="botao primario">Salvar ficha técnica</button>
    </form>
  );
}
