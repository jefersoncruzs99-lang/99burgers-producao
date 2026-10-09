"use client";

import { useActionState } from "react";
import { definirNovaSenha, type EstadoLogin } from "../actions";

export default function NovaSenha() {
  const [estado, acao, salvando] = useActionState<EstadoLogin, FormData>(definirNovaSenha, {});
  return (
    <main className="container pilha" style={{ maxWidth: 440, paddingTop: 48 }}>
      <h1>Criar nova senha</h1>
      <form action={acao} className="cartao pilha">
        <div className="campo">
          <label htmlFor="senha">Nova senha</label>
          <input id="senha" name="senha" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="campo">
          <label htmlFor="confirma">Repita a senha</label>
          <input id="confirma" name="confirma" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        {estado.erro && <div className="erro">{estado.erro}</div>}
        <button className="botao primario" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar senha"}
        </button>
      </form>
    </main>
  );
}
