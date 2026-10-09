"use client";

import { useActionState } from "react";
import { entrarCozinha, type EstadoCodigo } from "./actions";

export function FormCodigo() {
  const [estado, acao, enviando] = useActionState<EstadoCodigo, FormData>(entrarCozinha, {});
  return (
    <form action={acao} className="cartao pilha">
      <div className="campo">
        <label htmlFor="codigo">Código da cozinha</label>
        <input
          id="codigo"
          name="codigo"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          required
          style={{ fontSize: "1.6rem", textAlign: "center", letterSpacing: ".3em" }}
        />
      </div>
      {estado.erro && <div className="erro">{estado.erro}</div>}
      <button className="botao primario grande" disabled={enviando}>
        {enviando ? "Conferindo..." : "Liberar tablet"}
      </button>
    </form>
  );
}
