"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE;
const LOGIN_PATH = "/auth/login"; // ajuste se necessário

type LoginResponse = {
  tenant_id: string;
  user_id: string;
  token: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("token");
    const tenant = localStorage.getItem("tenant_id");
    if (token && tenant) router.replace("/students");
  }, [mounted, router]);

  const apiBase = useMemo(() => API ?? "", []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!apiBase) {
      setError("NEXT_PUBLIC_API_BASE não carregou. Reinicie o Next.");
      return;
    }

    if (!tenantId || !email || !password) {
      setError("Preencha todos os campos.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${apiBase}${LOGIN_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Credenciais inválidas");
      }

      const data = (await res.json()) as LoginResponse;

      localStorage.setItem("tenant_id", data.tenant_id);
      localStorage.setItem("token", data.token);

      router.replace("/students");
    } catch (err: any) {
      setError(err?.message ?? "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white shadow p-8 border border-neutral-200">
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Acesse sua escola informando o tenant.
          </p>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-xs font-semibold text-neutral-700">
                Tenant ID
              </label>
              <input
                className="mt-2 w-full h-12 rounded-2xl border border-neutral-300 px-4 text-neutral-900 focus:ring-4 focus:ring-black/10 outline-none"
                placeholder="UUID da escola"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700">
                Email
              </label>
              <input
                className="mt-2 w-full h-12 rounded-2xl border border-neutral-300 px-4 text-neutral-900 focus:ring-4 focus:ring-black/10 outline-none"
                placeholder="admin@escola.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700">
                Senha
              </label>
              <input
                type="password"
                className="mt-2 w-full h-12 rounded-2xl border border-neutral-300 px-4 text-neutral-900 focus:ring-4 focus:ring-black/10 outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>

            <button
              disabled={busy}
              className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-6 text-sm text-neutral-600 text-center">
            Ainda não tem escola?{" "}
            <button
              onClick={() => router.push("/register")}
              className="font-semibold text-black hover:underline"
            >
              Criar agora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
