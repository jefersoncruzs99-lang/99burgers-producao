import { exigirGestor } from "@/lib/auth";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { definirCodigoCozinha } from "../actions";

export default async function Config({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  await exigirGestor();
  return (
    <>
      <h1>Tablet da cozinha</h1>
      <Mensagens erro={sp.erro} ok={sp.ok} />
      <section className="cartao pilha" style={{ maxWidth: 520 }}>
        <h2>Código de acesso</h2>
        <p className="muted">
          O tablet pede este código uma única vez e fica liberado. Os colaboradores não precisam de login: só tocam
          no próprio nome. Se o tablet for perdido ou trocado, defina um código novo aqui.
        </p>
        <form action={definirCodigoCozinha} className="pilha">
          <div className="campo">
            <label htmlFor="codigo">Novo código (mínimo 4 caracteres)</label>
            <input id="codigo" name="codigo" type="password" minLength={4} required autoComplete="new-password" />
          </div>
          <div className="campo">
            <label htmlFor="confirma">Repita o código</label>
            <input id="confirma" name="confirma" type="password" minLength={4} required autoComplete="new-password" />
          </div>
          <button className="botao primario">Salvar código</button>
        </form>
      </section>
      <section className="cartao pilha" style={{ maxWidth: 520 }}>
        <h2>Como instalar no tablet</h2>
        <ol>
          <li>Abra o endereço do app no Chrome do tablet e toque em “Cozinha”.</li>
          <li>Digite o código acima.</li>
          <li>No menu do Chrome, toque em “Adicionar à tela inicial” para abrir como aplicativo.</li>
        </ol>
      </section>
    </>
  );
}
