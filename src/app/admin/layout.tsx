import Link from "next/link";
import { exigirGestor } from "@/lib/auth";
import { sair } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { nome } = await exigirGestor();
  return (
    <>
      <header className="topo">
        <div className="container linha entre" style={{ paddingBottom: 8 }}>
          <Link href="/admin" className="marca">
            NOVE NOVE · PRODUÇÃO
          </Link>
          <div className="linha">
            <span className="muted pequeno">{nome}</span>
            <form action={sair}>
              <button className="botao" style={{ minHeight: 36, padding: "6px 12px" }}>
                Sair
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Administração">
          <Link href="/admin">Quadro do dia</Link>
          <Link href="/admin/aprovacoes">Aprovações</Link>
          <Link href="/admin/modelos">Tarefas recorrentes</Link>
          <Link href="/admin/produtos">Produtos e fichas</Link>
          <Link href="/admin/equipe">Equipe</Link>
          <Link href="/admin/config">Tablet</Link>
        </nav>
      </header>
      <main className="container pilha">{children}</main>
    </>
  );
}
