"use client";

import { useActionState, useState } from "react";
import { entrar, recuperarSenha, type EstadoLogin } from "./actions";

export function FormLogin() {
  const [modo, setModo] = useState<"entrar" | "recuperar">("entrar");
  const [estadoEntrar, acaoEntrar, entrando] = useActionState<EstadoLogin, FormData>(entrar, {});
  const [estadoRec, acaoRec, enviando] = useActionState<EstadoLogin, FormData>(recuperarSenha, {});

  if (modo === "recuperar") {
    return (
      <form action={acaoRec} className="cartao pilha">
        <h2>Recuperar senha</h2>
        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        {estadoRec.erro && <div className="erro">{estadoRec.erro}</div>}
        {estadoRec.ok && <div className="ok">{estadoRec.ok}</div>}
        <button className="botao primario" disabled={enviando}>
          {enviando ? "Enviando..." : "Enviar link"}
        </button>
        <button type="button" className="botao" onClick={() => setModo("entrar")}>
          Voltar
        </button>
      </form>
    );
  }

  return (
    <form action={acaoEntrar} className="cartao pilha">
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      {estadoEntrar.erro && <div className="erro">{estadoEntrar.erro}</div>}
      <button className="botao primario" disabled={entrando}>
        {entrando ? "Entrando..." : "Entrar"}
      </button>
      <button type="button" className="botao" onClick={() => setModo("recuperar")}>
        Esqueci minha senha
      </button>
    </form>
  );
}
