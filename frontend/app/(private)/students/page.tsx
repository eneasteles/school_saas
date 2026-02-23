"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Student = {
  id: string;
  tenant_id: string;
  person_id: string;
  name: string;
  registration: string;
  class_id: string | null;
  birth_date: string | null;
  guardians: StudentGuardianRef[];
  student_email: string | null;
  notes: string | null;
};

type StudentGuardianRef = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
};

type Guardian = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

type ClassItem = {
  id: string;
  name: string;
  grade: string;
  year: number;
};

type Person = {
  person_id?: string;
  id?: string;
  person_type?: string;
  role_codes?: string[];
  full_name: string;
  email: string | null;
  notes: string | null;
};

type StudentLaunchOption = {
  person_id: string;
  full_name: string;
  email: string | null;
  notes: string | null;
  student_id: string | null;
  student_registration: string | null;
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function StudentsPage() {
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [studentPeople, setStudentPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [newStudentClassId, setNewStudentClassId] = useState<string>("");
  const [selectedGuardianIds, setSelectedGuardianIds] = useState<string[]>([]);
  const [assigningStudentId, setAssigningStudentId] = useState<string | null>(null);
  const [savingGuardiansStudentId, setSavingGuardiansStudentId] = useState<string | null>(null);
  const [studentGuardianSelections, setStudentGuardianSelections] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  function requireAuthOrRedirect() {
    const t = localStorage.getItem("token");
    const tid = localStorage.getItem("tenant_id");
    if (!t || !tid) {
      router.replace("/login");
      return null;
    }
    return { token: t };
  }

  async function loadClasses() {
    const auth = requireAuthOrRedirect();
    if (!auth || !API) return;

    const res = await fetch(`${API}/classes`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Erro carregando turmas");
    }

    const data = (await res.json()) as ClassItem[];
    setClasses(data);
  }

  async function loadGuardians() {
    const auth = requireAuthOrRedirect();
    if (!auth || !API) return;

    const res = await fetch(`${API}/guardians`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Erro carregando responsáveis vinculados");
    }
    const data = (await res.json()) as Guardian[];
    setGuardians(data);
  }

  async function loadStudents() {
    setError(null);
    setLoading(true);

    const auth = requireAuthOrRedirect();
    if (!auth || !API) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/students`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro carregando alunos");
      }

      const data = (await res.json()) as Student[];
      setStudents(data);
      const selections: Record<string, string[]> = {};
      data.forEach((s) => {
        selections[s.id] = s.guardians.map((g) => g.id);
      });
      setStudentGuardianSelections(selections);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function loadStudentPeople() {
    const auth = requireAuthOrRedirect();
    if (!auth || !API) return;
    let raw: Person[] = [];
    try {
      const res = await fetch(`${API}/students/available-people`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      raw = (await res.json()) as Person[];
    } catch {
      try {
        const fallbackRes = await fetch(`${API}/people?person_type=student&is_active=true`, {
          headers: { Authorization: `Bearer ${auth.token}` },
          cache: "no-store",
        });
        if (!fallbackRes.ok) throw new Error(await fallbackRes.text());
        raw = (await fallbackRes.json()) as Person[];
      } catch {
        const broadRes = await fetch(`${API}/people?is_active=true`, {
          headers: { Authorization: `Bearer ${auth.token}` },
          cache: "no-store",
        });
        if (!broadRes.ok) {
          const txt = await broadRes.text();
          throw new Error(txt || "Erro carregando cadastros de aluno");
        }
        const allPeople = (await broadRes.json()) as Person[];
        raw = allPeople.filter((p) => {
          const roles = p.role_codes ?? [];
          return p.person_type === "student" || roles.includes("student");
        });
      }
    }

    let normalized = raw
      .map((p) => normalizePersonOption(p))
      .filter((p) => p.person_id.length > 0);

    // Final fallback: if there is no candidate at all, list generic people
    // not yet launched as students so the flow never blocks.
    if (normalized.length === 0) {
      const broadRes = await fetch(`${API}/people?is_active=true`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        cache: "no-store",
      });
      if (broadRes.ok) {
        const allPeople = (await broadRes.json()) as Person[];
        normalized = allPeople
          .filter((p) => isStudentLikePerson(p))
          .map((p) => normalizePersonOption(p))
          .filter((p) => p.person_id.length > 0);
      }
    }
    setStudentPeople(normalized);
  }

  async function reloadAll() {
    try {
      await Promise.all([
        loadClasses(),
        loadStudents(),
        loadGuardians(),
        loadStudentPeople(),
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      setLoading(false);
    }
  }

  async function createStudent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const auth = requireAuthOrRedirect();
    if (!auth || !API) return;

    const selectedOption = availableStudentPeople.find((p) => p.person_id === selectedPersonId.trim());
    const selectedRegistration = selectedOption?.student_registration ?? extractStudentRegistration(selectedOption?.notes ?? null);

    if (!selectedOption) {
      setError("Selecione um cadastro tipo aluno.");
      return;
    }
    if (!selectedRegistration) {
      setError("Matrícula não encontrada no cadastro único. Edite o cadastro da pessoa e informe a matrícula.");
      return;
    }

    setBusy(true);
    try {
      if (selectedOption.student_id) {
        const profileRes = await fetch(`${API}/students/${selectedOption.student_id}/profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({
            birth_date: birthDate || null,
            student_email: (studentEmail || selectedOption.email || "").trim() || null,
          }),
        });
        if (!profileRes.ok) throw new Error(await profileRes.text());

        const classRes = await fetch(`${API}/students/${selectedOption.student_id}/class`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({ class_id: newStudentClassId || null }),
        });
        if (!classRes.ok) throw new Error(await classRes.text());

        const guardiansRes = await fetch(`${API}/students/${selectedOption.student_id}/guardians`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({ guardian_ids: selectedGuardianIds }),
        });
        if (!guardiansRes.ok) throw new Error(await guardiansRes.text());
      } else {
        const res = await fetch(`${API}/students`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({
            person_id: selectedOption.person_id,
            name: selectedOption.full_name,
            registration: selectedRegistration,
            class_id: newStudentClassId || null,
            birth_date: birthDate || null,
            guardian_ids: selectedGuardianIds,
            student_email: (studentEmail || selectedOption.email || "").trim() || null,
            notes: selectedOption.notes || null,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Erro criando aluno");
        }
      }

      setSelectedPersonId("");
      setBirthDate("");
      setStudentEmail("");
      setNewStudentClassId("");
      setSelectedGuardianIds([]);
      await Promise.all([loadStudents(), loadStudentPeople()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStudent(studentId: string) {
    setError(null);

    const auth = requireAuthOrRedirect();
    if (!auth || !API) return;

    setBusy(true);
    try {
      const res = await fetch(`${API}/students/${studentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro deletando aluno");
      }

      await loadStudents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function assignClass(studentId: string, classId: string | null) {
    setError(null);
    setAssigningStudentId(studentId);

    const auth = requireAuthOrRedirect();
    if (!auth || !API) return;

    try {
      const res = await fetch(`${API}/students/${studentId}/class`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ class_id: classId }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro vinculando turma");
      }

      await loadStudents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setAssigningStudentId(null);
    }
  }

  async function saveStudentGuardians(studentId: string) {
    setError(null);
    setSavingGuardiansStudentId(studentId);
    const auth = requireAuthOrRedirect();
    if (!auth || !API) return;

    try {
      const res = await fetch(`${API}/students/${studentId}/guardians`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          guardian_ids: studentGuardianSelections[studentId] ?? [],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadStudents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSavingGuardiansStudentId(null);
    }
  }

  function logout() {
    localStorage.removeItem("tenant_id");
    localStorage.removeItem("token");
    localStorage.removeItem("school_name");
    localStorage.removeItem("school_code");
    router.push("/login");
  }

  function classLabel(classId: string | null) {
    if (!classId) return "Sem turma";
    const found = classes.find((c) => c.id === classId);
    if (!found) return "Turma não encontrada";
    return `${found.grade} - ${found.name} (${found.year})`;
  }

  const filteredStudents = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.registration.toLowerCase().includes(q) ||
      s.guardians.some((g) => g.full_name.toLowerCase().includes(q))
    );
  });

  const availableStudentPeople = useMemo<StudentLaunchOption[]>(() => {
    const byPerson = new Map<string, StudentLaunchOption>();

    students.forEach((s) => {
      byPerson.set(s.person_id, {
        person_id: s.person_id,
        full_name: s.name,
        email: s.student_email,
        notes: s.notes,
        student_id: s.id,
        student_registration: s.registration,
      });
    });

    studentPeople.forEach((p) => {
      const existing = byPerson.get(p.person_id ?? "");
      if (existing) {
        byPerson.set(existing.person_id, {
          ...existing,
          full_name: p.full_name || existing.full_name,
          email: p.email ?? existing.email,
          notes: p.notes ?? existing.notes,
        });
      } else {
        byPerson.set(p.person_id ?? "", {
          person_id: p.person_id ?? "",
          full_name: p.full_name,
          email: p.email,
          notes: p.notes,
          student_id: null,
          student_registration: null,
        });
      }
    });

    return Array.from(byPerson.values())
      .filter((p) => p.person_id.length > 0)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [studentPeople, students]);

  useEffect(() => {
    if (!mounted) return;
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    if (!selectedPersonId) return;
    const selectedPerson = availableStudentPeople.find((p) => p.person_id === selectedPersonId.trim());
    if (!selectedPerson) return;

    if (selectedPerson.student_id) {
      const student = students.find((s) => s.id === selectedPerson.student_id);
      if (student) {
        setBirthDate(student.birth_date ?? "");
        setStudentEmail(student.student_email ?? selectedPerson.email ?? "");
        setNewStudentClassId(student.class_id ?? "");
        setSelectedGuardianIds(student.guardians.map((g) => g.id));
      }
      setError(null);
      return;
    }

    const reg = extractStudentRegistration(selectedPerson.notes);
    const birth = extractStudentBirthDate(selectedPerson.notes);
    setStudentEmail(selectedPerson.email ?? "");
    if (birth) setBirthDate(birth);
    if (!reg) {
      setError("Este cadastro de aluno não possui matrícula informada no Cadastro Único.");
    } else {
      setError(null);
    }
  }, [selectedPersonId, availableStudentPeople, students]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white shadow p-6 border border-neutral-200">
            <div className="text-sm text-neutral-600">Carregando...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Alunos</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Cadastro de alunos com vínculo de turma sem tenant na URL.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={reloadAll}
              className="h-10 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 disabled:opacity-60"
              disabled={loading || busy}
            >
              Atualizar
            </button>
            <button
              onClick={logout}
              className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow hover:bg-black"
            >
              Sair
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
            <div className="rounded-2xl bg-white shadow p-6 border border-neutral-200">
              <h2 className="text-lg font-semibold tracking-tight">Lançar Aluno do Cadastro Único</h2>
              <p className="mt-2 text-sm text-neutral-600">Selecione o aluno e complete somente dados específicos (turma, nascimento, responsáveis e e-mail).</p>

              <form className="mt-6 space-y-4" onSubmit={createStudent}>
                <div>
                  <label className="text-xs font-semibold text-neutral-700">Cadastro tipo aluno</label>
                  <select
                    className="mt-2 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                    value={selectedPersonId}
                    onChange={(e) => setSelectedPersonId(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Selecione o cadastro</option>
                    {availableStudentPeople.map((p) => (
                      <option key={p.person_id} value={p.person_id}>
                        {p.full_name} {p.student_id ? "(já lançado)" : "(novo)"}
                      </option>
                    ))}
                  </select>
                  {availableStudentPeople.length === 0 && (
                    <p className="mt-1 text-xs text-neutral-600">
                      {studentPeople.length === 0
                        ? "Nenhum cadastro tipo aluno encontrado no Cadastro Único."
                        : "Todos os cadastros tipo aluno já foram lançados na lista de alunos."}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                  Matrícula do cadastro: {(() => {
                    const selected = availableStudentPeople.find((p) => p.person_id === selectedPersonId);
                    return selected?.student_registration ?? extractStudentRegistration(selected?.notes ?? null) ?? "Não informada no Cadastro Único";
                  })()}
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700">Turma (opcional)</label>
                  <select
                    className="mt-2 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                    value={newStudentClassId}
                    onChange={(e) => setNewStudentClassId(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Sem turma</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.grade} - {c.name} ({c.year})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700">Data de nascimento (opcional)</label>
                  <input
                    type="date"
                    className="mt-2 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    disabled={busy}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700">Resp. vinculados (seleção)</label>
                  <select
                    multiple
                    className="mt-2 min-h-28 w-full rounded-2xl border-2 border-neutral-700 bg-white px-3 py-2 text-sm font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                    value={selectedGuardianIds}
                    onChange={(e) =>
                      setSelectedGuardianIds(
                        Array.from(e.target.selectedOptions).map((option) => option.value),
                      )
                    }
                    disabled={busy}
                  >
                    {guardians
                      .filter((g) => g.is_active)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.full_name}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-neutral-600">
                    Selecione um ou mais responsáveis vinculados já cadastrados na tela Resp. Vinculados.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700">E-mail do aluno (opcional)</label>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    disabled={busy}
                    placeholder="ex: aluno@escola.com"
                  />
                </div>

                <button
                  disabled={busy}
                  className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? "Salvando..." : "Salvar/Atualizar dados do aluno"}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white shadow p-6 border border-neutral-200">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold tracking-tight">Lista</h2>
                <div className="text-xs text-neutral-500">
                  {loading ? "Carregando..." : `${filteredStudents.length} aluno(s)`}
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-semibold text-neutral-700">Pesquisar aluno</label>
                <input
                  className="mt-2 h-10 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-sm font-semibold text-neutral-950"
                  placeholder="Nome, matrícula ou resp. vinculado"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="mt-4">
                {loading && <div className="text-sm text-neutral-600">Carregando...</div>}

                {!loading && filteredStudents.length === 0 && (
                  <div className="text-sm text-neutral-600">Nenhum aluno encontrado.</div>
                )}

                <div className="mt-4 grid gap-3">
                  {filteredStudents.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-neutral-200 bg-white p-4 hover:bg-neutral-50"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-neutral-900">{s.name}</div>
                          <div className="text-xs text-neutral-500">Matrícula: {s.registration}</div>
                          <div className="mt-1 text-xs text-neutral-500">Turma atual: {classLabel(s.class_id)}</div>
                          {s.birth_date && (
                            <div className="mt-1 text-xs text-neutral-500">Nascimento: {s.birth_date}</div>
                          )}
                          <div className="mt-1 text-xs text-neutral-500">
                            Resp. vinculados: {s.guardians.length > 0 ? s.guardians.map((g) => g.full_name).join(", ") : "Nenhum"}
                          </div>
                          {s.student_email && (
                            <div className="mt-1 text-xs text-neutral-500">E-mail: {s.student_email}</div>
                          )}
                          {s.notes && (
                            <div className="mt-1 text-xs text-neutral-500">Obs: {s.notes}</div>
                          )}
                        </div>
                        <button
                          onClick={() => deleteStudent(s.id)}
                          disabled={busy}
                          className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                        >
                          Excluir
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <select
                          defaultValue={s.class_id ?? ""}
                          onChange={(e) => assignClass(s.id, e.target.value || null)}
                          className="h-10 rounded-2xl border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                          disabled={assigningStudentId === s.id}
                        >
                          <option value="">Sem turma</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.grade} - {c.name}
                            </option>
                          ))}
                        </select>

                        {assigningStudentId === s.id && (
                          <span className="text-xs text-neutral-500">Salvando vínculo...</span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <select
                          multiple
                          value={studentGuardianSelections[s.id] ?? []}
                          onChange={(e) =>
                            setStudentGuardianSelections((prev) => ({
                              ...prev,
                              [s.id]: Array.from(e.target.selectedOptions).map((option) => option.value),
                            }))
                          }
                          className="min-h-24 rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                          disabled={savingGuardiansStudentId === s.id}
                        >
                          {guardians
                            .filter((g) => g.is_active)
                            .map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.full_name}
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => saveStudentGuardians(s.id)}
                          disabled={savingGuardiansStudentId === s.id}
                          className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-60"
                        >
                          {savingGuardiansStudentId === s.id ? "Salvando..." : "Salvar vínculos"}
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
      </div>
    </div>
  );
}

function extractStudentRegistration(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/Aluno - matr[ií]cula:\s*(.+)/i);
  return match?.[1]?.trim() || null;
}

function extractStudentBirthDate(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/Aluno - nascimento:\s*(\d{4}-\d{2}-\d{2})/i);
  return match?.[1] ?? null;
}

function normalizePersonOption(p: Person): {
  person_id: string;
  full_name: string;
  email: string | null;
  notes: string | null;
} {
  return {
    person_id: (p.person_id ?? p.id ?? "").trim(),
    full_name: p.full_name,
    email: p.email,
    notes: p.notes,
  };
}

function isStudentLikePerson(p: Person): boolean {
  const roles = p.role_codes ?? [];
  if (p.person_type === "student") return true;
  if (roles.includes("student")) return true;
  const notes = p.notes ?? "";
  if (/Aluno - matr[ií]cula:/i.test(notes)) return true;
  return false;
}
