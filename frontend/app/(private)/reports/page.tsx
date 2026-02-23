"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Person = {
  id: string;
  person_type: string;
  role_codes?: string[];
  full_name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  notes: string | null;
  is_active: boolean;
};

type Student = {
  id: string;
  person_id: string;
  name: string;
  registration: string;
  class_id: string | null;
  birth_date: string | null;
  student_email: string | null;
};

type Guardian = {
  id: string;
  person_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  is_active: boolean;
  students: Array<{ id: string; name: string; registration: string }>;
};

type Teacher = {
  id: string;
  person_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: string;
};

const API = process.env.NEXT_PUBLIC_API_BASE;

const REPORT_OPTIONS = [
  { value: "people_all", label: "Cadastros (todos)" },
  { value: "students", label: "Alunos" },
  { value: "parents", label: "Pais/Mães" },
  { value: "guardians", label: "Resp. Vinculados" },
  { value: "teachers", label: "Professores/Equipe" },
  { value: "financial", label: "Responsável Financeiro" },
  { value: "suppliers", label: "Fornecedores" },
] as const;

type ReportType = (typeof REPORT_OPTIONS)[number]["value"];

export default function ReportsPage() {
  const router = useRouter();
  const [reportType, setReportType] = useState<ReportType>("people_all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peopleRows, setPeopleRows] = useState<Person[]>([]);
  const [studentsRows, setStudentsRows] = useState<Student[]>([]);
  const [guardiansRows, setGuardiansRows] = useState<Guardian[]>([]);
  const [teachersRows, setTeachersRows] = useState<Teacher[]>([]);

  function requireToken() {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      router.replace("/login");
      return null;
    }
    return token;
  }

  async function loadReport() {
    setError(null);
    setLoading(true);
    const token = requireToken();
    if (!token) return;

    try {
      const basePeopleRes = await fetch(`${API}/people?is_active=true`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (basePeopleRes.ok) {
        setPeopleRows((await basePeopleRes.json()) as Person[]);
      }

      if (reportType === "students") {
        try {
          const res = await fetch(`${API}/students`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (!res.ok) throw new Error(await res.text());
          setStudentsRows((await res.json()) as Student[]);
        } catch {
          const res = await fetch(`${API}/people?person_type=student&is_active=true`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (!res.ok) throw new Error(await res.text());
          const people = (await res.json()) as Person[];
          setStudentsRows(
            people.map((p) => ({
              id: p.id,
              person_id: p.id,
              name: p.full_name,
              registration: extractRegistration(p.notes) ?? "-",
              class_id: null,
              birth_date: extractBirthDate(p.notes),
              student_email: p.email,
            })),
          );
        }
      } else if (reportType === "guardians") {
        try {
          const res = await fetch(`${API}/guardians`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (!res.ok) throw new Error(await res.text());
          setGuardiansRows((await res.json()) as Guardian[]);
        } catch {
          const res = await fetch(`${API}/people?person_type=guardian&is_active=true`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (!res.ok) throw new Error(await res.text());
          const people = (await res.json()) as Person[];
          setGuardiansRows(
            people.map((p) => ({
              id: p.id,
              person_id: p.id,
              full_name: p.full_name,
              email: p.email,
              phone: p.phone,
              document: p.document,
              is_active: p.is_active,
              students: [],
            })),
          );
        }
      } else if (reportType === "teachers") {
        try {
          const res = await fetch(`${API}/teachers`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (!res.ok) throw new Error(await res.text());
          setTeachersRows((await res.json()) as Teacher[]);
        } catch {
          const [teachersRes, staffRes] = await Promise.all([
            fetch(`${API}/people?person_type=teacher&is_active=true`, {
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
            }),
            fetch(`${API}/people?person_type=staff&is_active=true`, {
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
            }),
          ]);
          if (!teachersRes.ok) throw new Error(await teachersRes.text());
          if (!staffRes.ok) throw new Error(await staffRes.text());
          const merged = [
            ...((await teachersRes.json()) as Person[]),
            ...((await staffRes.json()) as Person[]),
          ];
          setTeachersRows(
            merged.map((p) => ({
              id: p.id,
              person_id: p.id,
              full_name: p.full_name,
              email: p.email ?? "",
              phone: p.phone,
              role: p.person_type,
            })),
          );
        }
      } else {
        // peopleRows base already loaded above.
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return studentsRows;
    return studentsRows.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.registration.toLowerCase().includes(q) ||
        (s.student_email ?? "").toLowerCase().includes(q),
    );
  }, [studentsRows, search]);

  const derivedStudentsFromPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return peopleRows
      .filter((p) => hasRole(p, "student"))
      .map((p) => ({
        id: p.id,
        person_id: p.id,
        name: p.full_name,
        registration: extractRegistration(p.notes) ?? "-",
        class_id: null,
        birth_date: extractBirthDate(p.notes),
        student_email: p.email,
      }))
      .filter((s) => {
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.registration.toLowerCase().includes(q) ||
          (s.student_email ?? "").toLowerCase().includes(q)
        );
      });
  }, [peopleRows, search]);

  const filteredGuardians = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guardiansRows;
    return guardiansRows.filter(
      (g) =>
        g.full_name.toLowerCase().includes(q) ||
        (g.email ?? "").toLowerCase().includes(q) ||
        g.students.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [guardiansRows, search]);

  const derivedGuardiansFromPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return peopleRows
      .filter((p) => hasRole(p, "guardian"))
      .map((p) => ({
        id: p.id,
        person_id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        document: p.document,
        is_active: p.is_active,
        students: [],
      }))
      .filter((g) => {
        if (!q) return true;
        return g.full_name.toLowerCase().includes(q) || (g.email ?? "").toLowerCase().includes(q);
      });
  }, [peopleRows, search]);

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachersRows;
    return teachersRows.filter(
      (t) =>
        (t.full_name ?? "").toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.role.toLowerCase().includes(q),
    );
  }, [teachersRows, search]);

  const derivedTeachersFromPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return peopleRows
      .filter((p) => hasRole(p, "teacher") || hasRole(p, "staff"))
      .map((p) => ({
        id: p.id,
        person_id: p.id,
        full_name: p.full_name,
        email: p.email ?? "",
        phone: p.phone,
        role: hasRole(p, "teacher") ? "teacher" : "staff",
      }))
      .filter((t) => {
        if (!q) return true;
        return (
          (t.full_name ?? "").toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          t.role.toLowerCase().includes(q)
        );
      });
  }, [peopleRows, search]);

  const filteredPeopleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = peopleRows;
    if (reportType === "parents") rows = rows.filter((p) => hasRole(p, "parent"));
    if (reportType === "financial") rows = rows.filter((p) => hasRole(p, "financial_guardian"));
    if (reportType === "suppliers") rows = rows.filter((p) => hasRole(p, "supplier"));
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.document ?? "").toLowerCase().includes(q),
    );
  }, [peopleRows, reportType, search]);

  const effectiveStudents = filteredStudents.length > 0 ? filteredStudents : derivedStudentsFromPeople;
  const effectiveGuardians = filteredGuardians.length > 0 ? filteredGuardians : derivedGuardiansFromPeople;
  const effectiveTeachers = filteredTeachers.length > 0 ? filteredTeachers : derivedTeachersFromPeople;

  function exportCsv() {
    const rows = buildCsvRows({
      reportType,
      peopleRows: filteredPeopleRows,
      studentsRows: effectiveStudents,
      guardiansRows: effectiveGuardians,
      teachersRows: effectiveTeachers,
    });
    if (rows.length === 0) return;
    const csv = rows.map((line) => line.map(escapeCsvCell).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${reportType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalCount =
    reportType === "students"
      ? effectiveStudents.length
      : reportType === "guardians"
        ? effectiveGuardians.length
        : reportType === "teachers"
          ? effectiveTeachers.length
          : filteredPeopleRows.length;

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Relatórios Diversos</h1>
            <p className="mt-2 text-sm font-medium text-neutral-700">Listagens gerais com filtros e exportação CSV.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadReport} className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow hover:bg-black">
              Atualizar
            </button>
            <button onClick={exportCsv} className="h-10 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-100">
              Exportar CSV
            </button>
          </div>
        </div>

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 grid gap-4 rounded-2xl border border-neutral-300 bg-white p-4 shadow md:grid-cols-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-neutral-800">Tipo de relatório</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="mt-1 h-11 w-full rounded-xl border-2 border-neutral-400 bg-white px-3 text-sm font-semibold text-neutral-900"
            >
              {REPORT_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wide text-neutral-800">Busca</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border-2 border-neutral-400 bg-white px-3 text-sm font-semibold text-neutral-900"
              placeholder="Nome, e-mail, matrícula, documento..."
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-300 bg-white p-5 shadow">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-neutral-900">Resultado</h2>
            <span className="text-xs font-semibold text-neutral-700">{loading ? "Carregando..." : `${totalCount} registro(s)`}</span>
          </div>

          {reportType === "students" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm text-neutral-900">
                <thead>
                  <tr className="border-b-2 border-neutral-300 bg-neutral-100 text-neutral-900">
                    <th className="px-3 py-2 font-bold">Nome</th>
                    <th className="px-3 py-2 font-bold">Matrícula</th>
                    <th className="px-3 py-2 font-bold">Nascimento</th>
                    <th className="px-3 py-2 font-bold">E-mail</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveStudents.map((s) => (
                    <tr key={s.id} className="border-b border-neutral-100">
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2">{s.registration}</td>
                      <td className="px-3 py-2">{s.birth_date || "-"}</td>
                      <td className="px-3 py-2">{s.student_email || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reportType === "guardians" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm text-neutral-900">
                <thead>
                  <tr className="border-b-2 border-neutral-300 bg-neutral-100 text-neutral-900">
                    <th className="px-3 py-2 font-bold">Responsável</th>
                    <th className="px-3 py-2 font-bold">E-mail</th>
                    <th className="px-3 py-2 font-bold">Telefone</th>
                    <th className="px-3 py-2 font-bold">Alunos vinculados</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveGuardians.map((g) => (
                    <tr key={g.id} className="border-b border-neutral-100">
                      <td className="px-3 py-2 font-medium">{g.full_name}</td>
                      <td className="px-3 py-2">{g.email || "-"}</td>
                      <td className="px-3 py-2">{g.phone || "-"}</td>
                      <td className="px-3 py-2">{g.students.map((s) => `${s.name} (${s.registration})`).join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reportType === "teachers" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm text-neutral-900">
                <thead>
                  <tr className="border-b-2 border-neutral-300 bg-neutral-100 text-neutral-900">
                    <th className="px-3 py-2 font-bold">Nome</th>
                    <th className="px-3 py-2 font-bold">E-mail</th>
                    <th className="px-3 py-2 font-bold">Telefone</th>
                    <th className="px-3 py-2 font-bold">Papel</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveTeachers.map((t) => (
                    <tr key={t.id} className="border-b border-neutral-100">
                      <td className="px-3 py-2 font-medium">{t.full_name || "-"}</td>
                      <td className="px-3 py-2">{t.email}</td>
                      <td className="px-3 py-2">{t.phone || "-"}</td>
                      <td className="px-3 py-2">{t.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!["students", "guardians", "teachers"].includes(reportType) && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm text-neutral-900">
                <thead>
                  <tr className="border-b-2 border-neutral-300 bg-neutral-100 text-neutral-900">
                    <th className="px-3 py-2 font-bold">Nome</th>
                    <th className="px-3 py-2 font-bold">Tipo principal</th>
                    <th className="px-3 py-2 font-bold">Papéis</th>
                    <th className="px-3 py-2 font-bold">Documento</th>
                    <th className="px-3 py-2 font-bold">E-mail</th>
                    <th className="px-3 py-2 font-bold">Telefone</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeopleRows.map((p) => (
                    <tr key={p.id} className="border-b border-neutral-100">
                      <td className="px-3 py-2 font-medium">{p.full_name}</td>
                      <td className="px-3 py-2">{p.person_type}</td>
                      <td className="px-3 py-2">{(p.role_codes ?? [p.person_type]).join(", ")}</td>
                      <td className="px-3 py-2">{p.document || "-"}</td>
                      <td className="px-3 py-2">{p.email || "-"}</td>
                      <td className="px-3 py-2">{p.phone || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && totalCount === 0 && (
            <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
              Nenhum registro encontrado para esse tipo de relatório.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildCsvRows({
  reportType,
  peopleRows,
  studentsRows,
  guardiansRows,
  teachersRows,
}: {
  reportType: ReportType;
  peopleRows: Person[];
  studentsRows: Student[];
  guardiansRows: Guardian[];
  teachersRows: Teacher[];
}): string[][] {
  if (reportType === "students") {
    return [
      ["Nome", "Matricula", "Nascimento", "Email"],
      ...studentsRows.map((s) => [s.name, s.registration, s.birth_date ?? "", s.student_email ?? ""]),
    ];
  }
  if (reportType === "guardians") {
    return [
      ["Responsavel", "Email", "Telefone", "Alunos"],
      ...guardiansRows.map((g) => [g.full_name, g.email ?? "", g.phone ?? "", g.students.map((s) => `${s.name} (${s.registration})`).join(" | ")]),
    ];
  }
  if (reportType === "teachers") {
    return [
      ["Nome", "Email", "Telefone", "Papel"],
      ...teachersRows.map((t) => [t.full_name ?? "", t.email, t.phone ?? "", t.role]),
    ];
  }
  return [
    ["Nome", "Tipo", "Papeis", "Documento", "Email", "Telefone"],
    ...peopleRows.map((p) => [p.full_name, p.person_type, (p.role_codes ?? [p.person_type]).join(", "), p.document ?? "", p.email ?? "", p.phone ?? ""]),
  ];
}

function escapeCsvCell(value: string): string {
  const safe = (value ?? "").replace(/"/g, "\"\"");
  return `"${safe}"`;
}

function extractRegistration(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/Aluno - matr[ií]cula:\s*(.+)/i);
  return m?.[1]?.trim() ?? null;
}

function extractBirthDate(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/Aluno - nascimento:\s*(\d{4}-\d{2}-\d{2})/i);
  return m?.[1] ?? null;
}

function hasRole(p: Person, roleCode: string): boolean {
  if (p.person_type === roleCode) return true;
  return (p.role_codes ?? []).includes(roleCode);
}
