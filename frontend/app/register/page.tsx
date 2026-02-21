"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function RegisterPage() {
  const router = useRouter();

  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = useMemo(() => API ?? "", []);

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

    const school_name = schoolName.trim();
    const school_code = slugify(schoolCode || schoolName); // se não preencher, gera do nome
    const eemail = email.trim().toLowerCase();
    const ppass = password;

    if (!apiBase) {
      setError("NEXT_PUBLIC_API_BASE não está definido no .env.local");
      return;
    }
    if (school_name.length < 2) {
      setError("Informe o nome da escola.");
      return;
    }
    if (school_code.length < 3) {
      setError("Informe um código de escola válido (mínimo 3).");
      return;
    }
    if (!eemail.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (ppass.length < 6) {
      setError("Senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_name,
          school_code, // <<< IMPORTANTE (slug)
          email: eemail,
          password: ppass,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "Erro ao cadastrar escola");
      }

      const data = JSON.parse(text) as {
        tenant_id: string;
        user_id: string;
        token: string;
      };

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
          <h1 className="text-2xl font-semibold tracking-tight">Cadastrar escola</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Crie sua escola e o usuário proprietário (owner). Depois você entra no sistema.
          </p>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Nome da escola</label>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                value={schoolName}
                onChange={(e) => {
                  const v = e.target.value;
                  setSchoolName(v);
                  if (!schoolCode) setSchoolCode(slugify(v));
                }}
                placeholder="Ex: Escola São José"
                disabled={busy}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700">Código da escola</label>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                value={schoolCode}
                onChange={(e) => setSchoolCode(slugify(e.target.value))}
                placeholder="ex: escola-sao-jose"
                disabled={busy}
              />
              <div className="mt-2 text-xs text-neutral-500">
                Use letras/números e hífen. Esse código será usado no login.
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700">E-mail do proprietário</label>
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
                placeholder="mínimo 6 caracteres"
                disabled={busy}
              />
            </div>

            <button
              className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "Criando..." : "Criar escola"}
            </button>

            <div className="text-center text-xs text-neutral-500">
              Já tem conta?{" "}
              <a className="font-semibold text-black hover:underline" href="/login">
                Entrar
              </a>
            </div>
          </form>
        </div>

        <div className="mt-4 text-center text-xs text-neutral-500">
          API: <span className="font-mono">{apiBase || "(defina NEXT_PUBLIC_API_BASE)"}</span>
        </div>
      </div>
    </div>
  );
}
