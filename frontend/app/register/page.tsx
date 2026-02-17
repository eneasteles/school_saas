"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE;

// 🔧 Se seu backend usar outro endpoint, troque só isso:
const REGISTER_PATH = "/auth/register";

type RegisterResponse = {
  tenant_id: string;
  user_id: string;
  token: string;
};

export default function RegisterPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [schoolName, setSchoolName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => setMounted(true), []);

  // Se já estiver logado, manda direto pro /students
  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("token");
    const tenantId = localStorage.getItem("tenant_id");
    if (token && tenantId) router.replace("/students");
  }, [mounted, router]);

  const apiBase = useMemo(() => API ?? "", []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const s = schoolName.trim();
    const em = email.trim().toLowerCase();
    const pw = password;

    if (!apiBase) {
      setError("NEXT_PUBLIC_API_BASE não carregou. Pare e rode `npm run dev` novamente.");
      return;
    }

    if (s.length < 2) {
      setError("Informe um nome de escola com pelo menos 2 caracteres.");
      return;
    }
    if (!em.includes("@")) {
      setError("Informe um email válido.");
      return;
    }
    if (pw.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${apiBase}${REGISTER_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ Compatível com o backend que você vinha usando
        body: JSON.stringify({
          school_name: s,
          email: em,
          password: pw,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro ao cadastrar escola");
      }

      const data = (await res.json()) as RegisterResponse;

      if (!data?.tenant_id || !data?.token) {
        throw new Error("Resposta inválida do servidor (faltando tenant_id/token).");
      }

      localStorage.setItem("tenant_id", data.tenant_id);
      localStorage.setItem("token", data.token);

      router.replace("/students");
    } catch (err: any) {
      setError(err?.message ?? "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl bg-white shadow p-6 border border-neutral-200">
            <div className="text-sm text-neutral-600">Carregando...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Criar sua escola</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Crie o tenant e o usuário administrador. Depois você já cai direto na área de alunos.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white shadow p-6 border border-neutral-200">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Nome da escola</label>
              <input
                className="mt-2 w-full h-12 rounded-2xl border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 placeholder:text-neutral-400 caret-black shadow-sm outline-none focus:ring-4 focus:ring-black/10"
                placeholder="ex: Escola Sol Nascente"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                disabled={busy}
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700">Email do administrador</label>
              <input
                className="mt-2 w-full h-12 rounded-2xl border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 placeholder:text-neutral-400 caret-black shadow-sm outline-none focus:ring-4 focus:ring-black/10"
                placeholder="ex: admin@escola.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                inputMode="email"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700">Senha</label>
              <input
                type="password"
                className="mt-2 w-full h-12 rounded-2xl border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 placeholder:text-neutral-400 caret-black shadow-sm outline-none focus:ring-4 focus:ring-black/10"
                placeholder="mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>

            <button
              disabled={busy}
              className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Criando..." : "Criar escola"}
            </button>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-sm font-semibold text-neutral-700 hover:underline"
              >
                Já tenho conta
              </button>

              <div className="text-xs text-neutral-500">
                API: <span className="font-mono">{apiBase || "—"}</span>
              </div>
            </div>
          </form>
        </div>

        {/* footer note */}
        <div className="mt-6 text-xs text-neutral-500">
          Para VPS depois: você vai trocar <span className="font-mono">NEXT_PUBLIC_API_BASE</span> para o domínio público
          (HTTPS) e restringir o CORS no backend.
        </div>
      </div>
    </div>
  );
}
