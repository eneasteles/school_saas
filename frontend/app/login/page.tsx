"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function LoginPage() {
  const router = useRouter();

  const [schoolCode, setSchoolCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function slugify(input: string) {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/(^-|-$)+/g, "");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const school_code = slugify(schoolCode);
    const eemail = email.trim().toLowerCase();

    if (!API) return setError("NEXT_PUBLIC_API_BASE não está definido no .env.local");
    if (school_code.length < 3) return setError("Informe o código da escola.");
    if (!eemail.includes("@")) return setError("Informe um e-mail válido.");
    if (password.length < 1) return setError("Informe a senha.");

    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_code, email: eemail, password }),
      });

      const txt = await res.text();
      if (!res.ok) throw new Error(txt || "Erro no login");

      const data = JSON.parse(txt) as { tenant_id: string; user_id: string; token: string };

      localStorage.setItem("tenant_id", data.tenant_id);
      localStorage.setItem("token", data.token);

      router.replace("/students");
    } catch (err: any) {
      setError(err?.message ?? "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-2 text-sm text-neutral-600">Acesse sua escola usando o código.</p>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Código da escola</label>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                value={schoolCode}
                onChange={(e) => setSchoolCode(slugify(e.target.value))}
                placeholder="ex: escola-sao-jose"
                disabled={busy}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700">E-mail</label>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex: admin@escola.com"
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
                placeholder="sua senha"
                disabled={busy}
              />
            </div>

            <button
              className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "Entrando..." : "Entrar"}
            </button>

            <div className="text-center text-xs text-neutral-500">
              Não tem escola ainda?{" "}
              <a className="font-semibold text-black hover:underline" href="/register">
                Criar agora
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
