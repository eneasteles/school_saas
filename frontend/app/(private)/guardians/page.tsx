"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Student = {
  id: string;
  name: string;
  registration: string;
};

type GuardianStudentRef = {
  id: string;
  name: string;
  registration: string;
};

type Guardian = {
  id: string;
  tenant_id: string;
  person_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  notes: string | null;
  is_active: boolean;
  students: GuardianStudentRef[];
};

type Person = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  notes: string | null;
  role_codes?: string[];
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function GuardiansPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [busyGuardianId, setBusyGuardianId] = useState<string | null>(null);

  function requireToken() {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      router.replace("/login");
      return null;
    }
    return token;
  }

  async function loadData() {
    setError(null);
    setLoading(true);
    const token = requireToken();
    if (!token) return;

    try {
      const [studentsRes, guardiansRes, guardianPeopleRes, financialPeopleRes, parentPeopleRes] = await Promise.all([
        fetch(`${API}/students`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/guardians`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/people?person_type=guardian&is_active=true`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/people?person_type=financial_guardian&is_active=true`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/people?person_type=parent&is_active=true`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);

      if (!studentsRes.ok) throw new Error(await studentsRes.text());
      if (!guardiansRes.ok) throw new Error(await guardiansRes.text());
      if (!guardianPeopleRes.ok) throw new Error(await guardianPeopleRes.text());
      if (!financialPeopleRes.ok) throw new Error(await financialPeopleRes.text());
      if (!parentPeopleRes.ok) throw new Error(await parentPeopleRes.text());

      setStudents((await studentsRes.json()) as Student[]);
      const guardiansList = (await guardiansRes.json()) as Guardian[];
      setGuardians(guardiansList);
      const mergedPeople = [
        ...((await guardianPeopleRes.json()) as Person[]),
        ...((await financialPeopleRes.json()) as Person[]),
        ...((await parentPeopleRes.json()) as Person[]),
      ];
      const uniqueById = new Map<string, Person>();
      mergedPeople.forEach((p) => uniqueById.set(p.id, p));
      setPeople(Array.from(uniqueById.values()));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  function toggleStudentSelection(studentId: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    );
  }

  async function createGuardian(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = requireToken();
    if (!token) return;

    const selectedPerson = availablePeople.find((p) => p.id === selectedPersonId);
    if (!selectedPerson) {
      setError("Selecione um cadastro para responsável.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/guardians`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          person_id: selectedPerson.id,
          full_name: selectedPerson.full_name,
          phone: selectedPerson.phone || null,
          email: selectedPerson.email || null,
          document: selectedPerson.document || null,
          notes: notes || selectedPerson.notes || null,
          is_active: isActive,
          student_ids: selectedStudentIds,
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      setSelectedPersonId("");
      setNotes("");
      setIsActive(true);
      setSelectedStudentIds([]);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function saveGuardianStudents(guardianId: string, studentIds: string[]) {
    setError(null);
    const token = requireToken();
    if (!token) return;

    setBusyGuardianId(guardianId);
    try {
      const res = await fetch(`${API}/guardians/${guardianId}/students`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ student_ids: studentIds }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusyGuardianId(null);
    }
  }

  async function deleteGuardian(guardianId: string) {
    setError(null);
    const token = requireToken();
    if (!token) return;
    if (!window.confirm("Excluir este responsável vinculado?")) return;

    setBusyGuardianId(guardianId);
    try {
      const res = await fetch(`${API}/guardians/${guardianId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusyGuardianId(null);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availablePeople = people
    .filter((p) => !guardians.some((g) => g.person_id === p.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Responsáveis Vinculados ao Aluno</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Cadastre responsáveis vinculados e relacione com um ou mais alunos.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadData} className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow hover:bg-black">
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
          <div className="lg:col-span-1 rounded-2xl border border-neutral-200 bg-white p-6 shadow">
            <h2 className="text-lg font-semibold tracking-tight">Novo responsável vinculado</h2>
            <form className="mt-4 space-y-4" onSubmit={createGuardian}>
              <div>
                <label className="text-sm font-bold text-neutral-950">Cadastro de responsável</label>
                <select
                  className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-sm font-semibold text-neutral-950"
                  value={selectedPersonId}
                  onChange={(e) => setSelectedPersonId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Selecione</option>
                  {availablePeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
                {availablePeople.length === 0 && (
                  <p className="mt-1 text-xs text-neutral-600">
                    Nenhum cadastro disponível (responsável vinculado, financeiro ou pai/mãe).
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-bold text-neutral-950">Observações</label>
                <textarea
                  className="mt-2 min-h-20 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 py-2 text-sm font-semibold text-neutral-950"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={busy}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Ativo
              </label>

              <div>
                <div className="text-sm font-bold text-neutral-950">Vincular alunos</div>
                <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-xl border border-neutral-300 p-2">
                  {students.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-xs text-neutral-800">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(s.id)}
                        onChange={() => toggleStudentSelection(s.id)}
                      />
                      {s.name} ({s.registration})
                    </label>
                  ))}
                  {students.length === 0 && <div className="text-xs text-neutral-500">Sem alunos cadastrados.</div>}
                </div>
              </div>

              <button
                disabled={busy}
                className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Salvando..." : "Cadastrar responsável vinculado"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Lista de responsáveis vinculados</h2>
              <div className="text-xs text-neutral-500">{loading ? "Carregando..." : `${guardians.length} vínculo(s)`}</div>
            </div>

            <div className="mt-4 grid gap-3">
              {guardians.map((g) => (
                <GuardianCard
                  key={`${g.id}-${g.students.map((s) => s.id).join(",")}`}
                  guardian={g}
                  students={students}
                  busy={busyGuardianId === g.id}
                  onSaveStudents={(ids) => saveGuardianStudents(g.id, ids)}
                  onDelete={() => deleteGuardian(g.id)}
                />
              ))}
              {!loading && guardians.length === 0 && (
                <div className="text-sm text-neutral-600">Nenhum responsável vinculado cadastrado.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuardianCard({
  guardian,
  students,
  busy,
  onSaveStudents,
  onDelete,
}: {
  guardian: Guardian;
  students: Student[];
  busy: boolean;
  onSaveStudents: (studentIds: string[]) => void;
  onDelete: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(guardian.students.map((s) => s.id));

  function toggle(studentId: string) {
    setSelected((prev) => (prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]));
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-neutral-900">{guardian.full_name}</div>
          <div className="text-xs text-neutral-500">
            {guardian.phone || "-"} | {guardian.email || "-"} | {guardian.is_active ? "Ativo" : "Inativo"}
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={busy}
          className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
        >
          Excluir
        </button>
      </div>

      <div className="mt-3 text-xs text-neutral-700">Alunos vinculados</div>
      <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-xl border border-neutral-300 p-2">
        {students.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-xs text-neutral-800">
            <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
            {s.name} ({s.registration})
          </label>
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={() => onSaveStudents(selected)}
          disabled={busy}
          className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-60"
        >
          {busy ? "Salvando..." : "Salvar vínculos"}
        </button>
      </div>
    </div>
  );
}
