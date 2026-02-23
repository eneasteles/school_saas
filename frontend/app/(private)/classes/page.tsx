"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ClassItem = {
  id: string;
  tenant_id: string;
  name: string;
  grade: string;
  year: number;
  period: string;
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [period, setPeriod] = useState("matutino");

  function requireToken() {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      router.replace("/login");
      return null;
    }
    return token;
  }

  async function loadClasses() {
    setError(null);
    setLoading(true);

    const token = requireToken();
    if (!token) return;

    try {
      const res = await fetch(`${API}/classes`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro carregando turmas");
      }
      setClasses((await res.json()) as ClassItem[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const token = requireToken();
    if (!token) return;

    const yy = Number(year);
    if (!name.trim() || !grade.trim() || Number.isNaN(yy) || yy < 2000 || yy > 2100) {
      setError("Preencha nome/série e ano válido.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/classes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          grade: grade.trim(),
          year: yy,
          period,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro criando turma");
      }

      setName("");
      setGrade("");
      setYear(new Date().getFullYear().toString());
      setPeriod("matutino");
      await loadClasses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function deleteClass(classId: string) {
    setError(null);
    const token = requireToken();
    if (!token) return;

    setBusy(true);
    try {
      const res = await fetch(`${API}/classes/${classId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro removendo turma");
      }
      await loadClasses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Turmas</h1>
            <p className="mt-2 text-sm text-neutral-600">Gestão de turmas/séries da escola.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadClasses}
              className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow hover:bg-black"
            >
              Atualizar
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
              <h2 className="text-lg font-semibold tracking-tight">Nova turma</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Identifique claramente o nome da turma, a série e o ano letivo.
              </p>
              <form className="mt-4 space-y-4" onSubmit={createClass}>
                <div>
                  <label className="text-sm font-bold text-neutral-950">Nome da turma</label>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                    placeholder="ex: Turma A"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                  />
                  <p className="mt-1 text-xs font-medium text-neutral-600">Nome identificador da turma.</p>
                </div>
                <div>
                  <label className="text-sm font-bold text-neutral-950">Série</label>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                    placeholder="ex: 1 ano"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    disabled={busy}
                  />
                  <p className="mt-1 text-xs font-medium text-neutral-600">Etapa escolar da turma.</p>
                </div>
                <div>
                  <label className="text-sm font-bold text-neutral-950">Ano letivo</label>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                    placeholder="ex: 2026"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    disabled={busy}
                  />
                  <p className="mt-1 text-xs font-medium text-neutral-600">Ano em que a turma está ativa.</p>
                </div>
                <div>
                  <label className="text-sm font-bold text-neutral-950">Período</label>
                  <select
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    disabled={busy}
                  >
                    <option value="matutino">Matutino</option>
                    <option value="vespertino">Vespertino</option>
                    <option value="noturno">Noturno</option>
                    <option value="integral">Integral</option>
                  </select>
                  <p className="mt-1 text-xs font-medium text-neutral-600">Selecione o turno de funcionamento.</p>
                </div>
                <button
                  className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
                  disabled={busy}
                >
                  Criar turma
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
              <div className="text-xs text-neutral-500">{loading ? "Carregando..." : `${classes.length} turma(s)`}</div>
              <div className="mt-4 grid gap-3">
                {classes.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-2xl border border-neutral-200 p-4"
                  >
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">{c.grade} - {c.name}</div>
                      <div className="text-xs text-neutral-500">Ano letivo: {c.year}</div>
                      <div className="text-xs text-neutral-500">Período: {c.period}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/attendance?class_id=${c.id}`)}
                        className="rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                      >
                        Presença
                      </button>
                      <button
                        onClick={() => router.push(`/gradebook?class_id=${c.id}`)}
                        className="rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                      >
                        Boletim
                      </button>
                      <button
                        onClick={() => deleteClass(c.id)}
                        disabled={busy}
                        className="rounded-2xl border-2 border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
                {!loading && classes.length === 0 && (
                  <div className="text-sm text-neutral-600">Nenhuma turma cadastrada.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
