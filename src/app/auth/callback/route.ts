import { NextResponse, type NextRequest } from "next/server";
import { criarSupabaseServidor } from "@/lib/supabase/server";

/** Recebe o link do e-mail (recuperação de senha) e cria a sessão. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const codigo = url.searchParams.get("code");
  const proximoBruto = url.searchParams.get("proximo") ?? "/admin";
  // Só redireciona para caminhos internos.
  const proximo = proximoBruto.startsWith("/") && !proximoBruto.startsWith("//") ? proximoBruto : "/admin";

  if (codigo) {
    const supabase = await criarSupabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(proximo, url.origin));
  }
  return NextResponse.redirect(new URL("/login?expirada=1", url.origin));
}
