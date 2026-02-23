"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!API) {
      setError("NEXT_PUBLIC_API_BASE não está definido no .env.local");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/platform/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const txt = await res.text();
      if (!res.ok) throw new Error(txt || "Erro no login da plataforma");

      const data = JSON.parse(txt) as { token: string; role: string; scope: string };
      localStorage.setItem("platform_token", data.token);
      localStorage.setItem("platform_role", data.role);
      router.replace("/admin/clients");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
          <h1 className="text-2xl font-semibold tracking-tight">Login Admin SaaS</h1>
          <p className="mt-2 text-sm text-neutral-600">Acesso ao painel global da plataforma.</p>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-xs font-semibold text-neutral-700">E-mail</label>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@platform.local"
                disabled={busy}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Senha</label>
              <input
                type="password"
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="sua senha de plataforma"
                disabled={busy}
              />
            </div>
            <button
              className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "Entrando..." : "Entrar no Admin SaaS"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
