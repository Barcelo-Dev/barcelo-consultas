"use client";
import { createBrowserClient } from "@supabase/ssr";

// Cliente de navegador. Lo usa la página de login para iniciar sesión.
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
