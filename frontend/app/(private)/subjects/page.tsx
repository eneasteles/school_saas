"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Teacher = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
};

type Subject = {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  teacher_user_id: string | null;
  teacher_name: string | null;
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function SubjectsPage() {
  const router = useRouter();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [teacherUserId, setTeacherUserId] = useState("");

  function requireToken() {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      router.replace("/login");
      return null;
    }
    return token;
  }

  async function loadTeachers(token: string) {
    const res = await fetch(`${API}/teachers`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    setTeachers((await res.json()) as Teacher[]);
  }

  async function loadSubjects(token: string) {
    const res = await fetch(`${API}/subjects`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    setSubjects((await res.json()) as Subject[]);
  }

  async function reload() {
    setError(null);
    setLoading(true);
    const token = requireToken();
    if (!token) return;
    try {
      await Promise.all([loadTeachers(token), loadSubjects(token)]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function createSubject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = requireToken();
    if (!token) return;

    if (!name.trim()) {
      setError("Informe o nome da disciplina.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/subjects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          code: code || null,
          teacher_user_id: teacherUserId || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      setName("");
      setCode("");
      setTeacherUserId("");
      await loadSubjects(token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function assignTeacher(subjectId: string, teacherId: string | null) {
    setError(null);
    const token = requireToken();
    if (!token) return;

    setBusy(true);
    try {
      const res = await fetch(`${API}/subjects/${subjectId}/teacher`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teacher_user_id: teacherId }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadSubjects(token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Disciplinas</h1>
            <p className="mt-2 text-sm text-neutral-600">Cadastre disciplinas e associe ao professor.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={reload} className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow hover:bg-black">
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
              <h2 className="text-lg font-semibold tracking-tight">Nova disciplina</h2>
              <form className="mt-4 space-y-4" onSubmit={createSubject}>
                <div>
                  <label className="text-sm font-semibold text-neutral-900">Nome</label>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-medium text-neutral-900 placeholder:text-neutral-500 outline-none focus:ring-4 focus:ring-black/10"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex: Matemática"
                    disabled={busy}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-neutral-900">Código (opcional)</label>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-medium text-neutral-900 placeholder:text-neutral-500 outline-none focus:ring-4 focus:ring-black/10"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ex: MAT"
                    disabled={busy}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-neutral-900">Professor cadastrado</label>
                  <select
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                    value={teacherUserId}
                    onChange={(e) => setTeacherUserId(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Sem professor</option>
                    {teachers
                      .filter((t) => t.role === "teacher")
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name ?? t.email} ({t.role})
                        </option>
                      ))}
                  </select>
                  {teachers.filter((t) => t.role === "teacher").length === 0 && (
                    <div className="mt-2 text-xs font-semibold text-amber-700">
                      Nenhum professor com papel `teacher` cadastrado.
                    </div>
                  )}
                </div>
                <button
                  className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
                  disabled={busy}
                >
                  Cadastrar disciplina
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
              <div className="text-xs text-neutral-500">{loading ? "Carregando..." : `${subjects.length} disciplina(s)`}</div>
              <div className="mt-4 grid gap-3">
                {subjects.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm font-semibold text-neutral-900">{s.name}</div>
                    <div className="text-xs text-neutral-500">
                      Código: {s.code || "-"} | Professor: {s.teacher_name || "Não atribuído"}
                    </div>
                    <div className="mt-3">
                      <select
                        className="h-10 w-full rounded-xl border-2 border-neutral-500 bg-white px-3 text-sm font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                        value={s.teacher_user_id ?? ""}
                        onChange={(e) => assignTeacher(s.id, e.target.value || null)}
                        disabled={busy}
                      >
                        <option value="">Sem professor</option>
                        {teachers
                          .filter((t) => t.role === "teacher")
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name ?? t.email} ({t.role})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ))}
                {!loading && subjects.length === 0 && (
                  <div className="text-sm text-neutral-600">Nenhuma disciplina cadastrada.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
