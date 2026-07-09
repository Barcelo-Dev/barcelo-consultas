"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src="/logo.png"
            alt="Barceló Guatemala City"
            className="mx-auto h-8 w-auto"
          />
          <p className="mt-6 font-display text-xl font-bold text-barcelo-ink">
            Portal de consultas
          </p>
          <p className="mt-1 text-sm text-barcelo-gray">
            Acceso exclusivo del personal autorizado.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl bg-white p-8 shadow-xl"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-barcelo-ink"
            >
              Correo
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-barcelo-gray/30 px-4 py-2.5 outline-none transition focus:border-barcelo-teal focus:ring-2 focus:ring-barcelo-teal/20"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-barcelo-ink"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-barcelo-gray/30 px-4 py-2.5 outline-none transition focus:border-barcelo-teal focus:ring-2 focus:ring-barcelo-teal/20"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-barcelo-teal px-4 py-3 font-semibold text-white transition hover:bg-barcelo-deep focus:outline-none focus:ring-2 focus:ring-barcelo-teal/40 disabled:opacity-60"
          >
            {loading ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </main>
  );
}
