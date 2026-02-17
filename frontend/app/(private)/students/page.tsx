"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";


type Student = {
  id: string;
  tenant_id: string;
  name: string;
  registration: string;
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function StudentsPage() {
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); // usado para ações (create/delete)
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Form statefetch
  const [name, setName] = useState("");
  const [registration, setRegistration] = useState("");

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }, []);

  const tenantId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("tenant_id");
  }, []);

  function requireAuthOrRedirect() {
    const t = localStorage.getItem("token");
    const tid = localStorage.getItem("tenant_id");
    if (!t || !tid) {
      router.replace("/login");
      return null;
    }
    return { token: t, tenantId: tid };
  }

  async function loadStudents() {
    setError(null);
    setLoading(true);

    const auth = requireAuthOrRedirect();
    if (!auth) return;
    console.log("API BASE =", API);
    console.log("Fetching URL =", `${API}/tenants/${auth.tenantId}/students`);


    try {
      const res = await fetch(`${API}/tenants/${auth.tenantId}/students`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro carregando alunos");
      }

      const data = (await res.json()) as Student[];
      setStudents(data);
    } catch (err: any) {
      console.log("Fetch error =", err);

      setError(err?.message ?? "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function createStudent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const auth = requireAuthOrRedirect();
    if (!auth) return;

    const n = name.trim();
    const r = registration.trim();

    if (!n || !r) {
      setError("Preencha nome e matrícula.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/tenants/${auth.tenantId}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ name: n, registration: r }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro criando aluno");
      }

      // limpa form
      setName("");
      setRegistration("");

      // refresh automático
      await loadStudents();
    } catch (err: any) {
      setError(err?.message ?? "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStudent(studentId: string) {
    // Se você ainda não tem DELETE no backend, pode remover essa função por enquanto.
    // Mantive pronto pro futuro.
    setError(null);

    const auth = requireAuthOrRedirect();
    if (!auth) return;

    setBusy(true);
    try {
      const res = await fetch(`${API}/tenants/${auth.tenantId}/students/${studentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro deletando aluno");
      }

      await loadStudents();
    } catch (err: any) {
      setError(err?.message ?? "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem("tenant_id");
    localStorage.removeItem("token");
    router.push("/login");
  }

  useEffect(() => {
    // garante redirecionamento se não tiver sessão
    const t = localStorage.getItem("token");
    const tid = localStorage.getItem("tenant_id");
    if (!t || !tid) {
      router.replace("/login");
      return;
    }
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!mounted) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-white shadow p-6 border border-neutral-200">
            <div className="text-sm text-neutral-600">Carregando...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Alunos</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Cadastro e listagem por escola (tenant).
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadStudents}
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-60"
              disabled={loading || busy}
            >
              Atualizar
            </button>
            <button
              onClick={logout}
              className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Form */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl bg-white shadow p-6 border border-neutral-200">
              <h2 className="text-lg font-semibold tracking-tight">Novo aluno</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Cadastre um aluno e a lista atualiza automaticamente.
              </p>

              <form className="mt-6 space-y-4" onSubmit={createStudent}>
                <div>
                  <label className="text-xs font-semibold text-neutral-700">Nome</label>
                  <input
                    className="mt-2 w-full h-12 rounded-2xl border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 placeholder:text-neutral-400 caret-black shadow-sm outline-none focus:ring-4 focus:ring-black/10"
                    placeholder="ex: João Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700">Matrícula</label>
                  <input
                    className="mt-2 w-full h-12 rounded-2xl border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 placeholder:text-neutral-400 caret-black shadow-sm outline-none focus:ring-4 focus:ring-black/10"
                    placeholder="ex: 2025001"
                    value={registration}
                    onChange={(e) => setRegistration(e.target.value)}
                    disabled={busy}
                  />
                </div>

                <button
                  disabled={busy}
                  className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? "Salvando..." : "Cadastrar aluno"}
                </button>

                <div className="text-xs text-neutral-500">
                  {tenantId ? (
                    <>Tenant: <span className="font-mono">{tenantId}</span></>
                  ) : (
                    "Tenant não encontrado."
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* List */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white shadow p-6 border border-neutral-200">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold tracking-tight">Lista</h2>
                <div className="text-xs text-neutral-500">
                  {loading ? "Carregando..." : `${students.length} aluno(s)`}
                </div>
              </div>

              <div className="mt-4">
                {loading && <div className="text-sm text-neutral-600">Carregando...</div>}

                {!loading && students.length === 0 && (
                  <div className="text-sm text-neutral-600">
                    Nenhum aluno encontrado. Cadastre ao lado.
                  </div>
                )}

                <div className="mt-4 grid gap-3">
                  {students.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 hover:bg-neutral-50"
                    >
                      <div>
                        <div className="text-sm font-semibold text-neutral-900">{s.name}</div>
                        <div className="text-xs text-neutral-500">Matrícula: {s.registration}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="hidden sm:block text-xs font-mono text-neutral-400">
                          {s.id}
                        </div>

                        {/* DELETE é opcional - só funciona se você implementar no backend */}
                        <button
                          onClick={() => deleteStudent(s.id)}
                          disabled={busy}
                          className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                          title="Requer endpoint DELETE no backend"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-xs text-neutral-500">
                  {token ? (
                    <>Token: <span className="font-mono">{token.slice(0, 18)}...</span></>
                  ) : (
                    "Token não encontrado."
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* VPS note */}
        <div className="mt-8 text-xs text-neutral-500">
          Dica para VPS: depois você troca <span className="font-mono">NEXT_PUBLIC_API_BASE</span> para o domínio/IP público
          (e habilita HTTPS + CORS restrito).
        </div>
      </div>
    </div>
  );
}
