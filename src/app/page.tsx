import Link from "next/link";
import { supabaseConfigurado } from "@/lib/supabase/server";

export default function Inicio() {
  return (
    <main className="container pilha" style={{ maxWidth: 560, paddingTop: 48 }}>
      <h1>
        <span className="marca">NOVE NOVE BURGERS</span>
        <br />
        Produção da cozinha
      </h1>
      {!supabaseConfigurado() && (
        <div className="erro">
          Configuração pendente: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </div>
      )}
      <Link href="/cozinha" className="botao primario grande cheio">
        Cozinha (tablet)
      </Link>
      <Link href="/admin" className="botao grande cheio">
        Administração
      </Link>
    </main>
  );
}
