"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ClassItem = {
  id: string;
  name: string;
  grade: string;
  year: number;
  period: string;
};

type SubjectItem = {
  id: string;
  name: string;
  code: string | null;
};

type AttendanceItem = {
  student_id: string;
  student_name: string;
  registration: string;
  present: boolean;
  notes: string | null;
};

type AttendanceResponse = {
  class_id: string;
  date: string;
  subject_id: string;
  items: AttendanceItem[];
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function AttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classId, setClassId] = useState(searchParams.get("class_id") ?? "");
  const [subjectId, setSubjectId] = useState(searchParams.get("subject_id") ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function requireToken() {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      router.replace("/login");
      return null;
    }
    return token;
  }

  async function loadClasses() {
    const token = requireToken();
    if (!token) return;
    const res = await fetch(`${API}/classes`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as ClassItem[];
    setClasses(data);
    if (!classId && data.length > 0) setClassId(data[0].id);
  }

  async function loadSubjects() {
    const token = requireToken();
    if (!token) return;
    const res = await fetch(`${API}/subjects`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as SubjectItem[];
    setSubjects(data);
    if (!subjectId && data.length > 0) setSubjectId(data[0].id);
  }

  async function loadAttendance() {
    if (!classId || !subjectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const token = requireToken();
    if (!token) return;

    const query = new URLSearchParams({ date, subject_id: subjectId });
    const res = await fetch(`${API}/classes/${classId}/attendance?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as AttendanceResponse;
    setItems(data.items);
  }

  async function reload() {
    setError(null);
    setLoading(true);
    try {
      await loadClasses();
      await loadSubjects();
      await loadAttendance();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  function updateItem(studentId: string, patch: Partial<AttendanceItem>) {
    setItems((prev) => prev.map((i) => (i.student_id === studentId ? { ...i, ...patch } : i)));
  }

  function setAllPresence(present: boolean) {
    setItems((prev) => prev.map((i) => ({ ...i, present })));
  }

  async function saveAttendance() {
    setError(null);
    if (!classId || !subjectId) return;
    const token = requireToken();
    if (!token) return;

    setBusy(true);
    try {
      const res = await fetch(`${API}/classes/${classId}/attendance`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date,
          subject_id: subjectId,
          records: items.map((i) => ({
            student_id: i.student_id,
            present: i.present,
            notes: i.notes || null,
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAttendance();
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

  useEffect(() => {
    if (!classId || !subjectId) return;
    loadAttendance().catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro inesperado"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subjectId, date]);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Presença por Disciplina</h1>
            <p className="mt-2 text-sm text-neutral-600">Marque presença dos alunos por turma, disciplina e data.</p>
          </div>
          <div />
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-bold text-neutral-950">Turma</label>
              <select
                className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">Selecione</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.grade} - {c.name} ({c.period})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs font-medium text-neutral-600">Escolha a turma da chamada.</p>
            </div>

            <div>
              <label className="text-sm font-bold text-neutral-950">Disciplina</label>
              <select
                className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">Selecione</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs font-medium text-neutral-600">A presença e por disciplina.</p>
            </div>

            <div>
              <label className="text-sm font-bold text-neutral-950">Data</label>
              <input
                type="date"
                className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <p className="mt-1 text-xs font-medium text-neutral-600">Data da aula.</p>
            </div>

            <div className="md:col-span-4">
              <div className="flex flex-wrap items-end gap-2">
                <button
                  onClick={() => setAllPresence(true)}
                  disabled={loading || !classId || !subjectId || items.length === 0}
                  className="h-10 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 shadow hover:bg-neutral-100 disabled:opacity-60"
                >
                  Marcar todos
                </button>
                <button
                  onClick={() => setAllPresence(false)}
                  disabled={loading || !classId || !subjectId || items.length === 0}
                  className="h-10 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 shadow hover:bg-neutral-100 disabled:opacity-60"
                >
                  Desmarcar todos
                </button>
                <button
                  onClick={reload}
                  className="h-10 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 shadow hover:bg-neutral-100"
                >
                  Atualizar
                </button>
                <button
                  onClick={saveAttendance}
                  disabled={busy || loading || !classId || !subjectId}
                  className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow hover:bg-black disabled:opacity-60"
                >
                  {busy ? "Salvando..." : "Salvar presença"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {loading && <div className="text-sm text-neutral-600">Carregando...</div>}
            {!loading && items.length === 0 && <div className="text-sm text-neutral-600">Nenhum aluno nessa turma.</div>}
            {items.map((i) => (
              <div key={i.student_id} className="rounded-2xl border border-neutral-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">{i.student_name}</div>
                    <div className="text-xs text-neutral-500">Matricula: {i.registration}</div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-800">
                    <input
                      type="checkbox"
                      checked={i.present}
                      onChange={(e) => updateItem(i.student_id, { present: e.target.checked })}
                    />
                    Presente
                  </label>
                </div>
                <textarea
                  className="mt-3 min-h-20 w-full rounded-2xl border-2 border-neutral-700 bg-white px-3 py-2 text-sm font-medium text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                  placeholder="Observacoes (opcional)"
                  value={i.notes ?? ""}
                  onChange={(e) => updateItem(i.student_id, { notes: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
