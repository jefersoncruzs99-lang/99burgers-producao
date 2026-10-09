"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente do navegador. Usado só para enviar fotos (o bucket aceita apenas envio). */
export function criarSupabaseNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
