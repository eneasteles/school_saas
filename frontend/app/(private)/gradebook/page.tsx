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

type GradeItem = {
  student_id: string;
  student_name: string;
  registration: string;
  score: number | null;
  absences: number;
  comments: string | null;
};

type GradebookResponse = {
  class_id: string;
  term_id: string;
  term_name: string;
  subject_id: string;
  subject_name: string;
  items: GradeItem[];
};

type GradebookReportStudent = {
  student_id: string;
  student_name: string;
  registration: string;
  score: number | null;
  absences_gradebook: number;
  comments: string | null;
  attendance_total_days: number;
  attendance_present_days: number;
  attendance_absent_days: number;
  attendance_percent: number;
};

type GradebookReportResponse = {
  class_id: string;
  class_name: string;
  class_grade: string;
  class_year: number;
  class_period: string;
  term_id: string;
  term_name: string;
  subject_id: string;
  subject_name: string;
  generated_at: string;
  students: GradebookReportStudent[];
};

type ShareReportResponse = {
  token: string;
  expires_at: string;
};

type StudentFullReportPeriod = {
  term_id: string;
  term_name: string;
  school_year: number;
  sort_order: number;
};

type StudentFullReportPeriodGrade = {
  term_id: string;
  term_name: string;
  score: number | null;
  absences_gradebook: number;
  comments: string | null;
};

type StudentFullReportSubject = {
  subject_id: string;
  subject_name: string;
  period_grades: StudentFullReportPeriodGrade[];
  average_score: number | null;
  approved: boolean;
  status: string;
};

type StudentFullReportResponse = {
  class_id: string;
  class_name: string;
  class_grade: string;
  class_year: number;
  class_period: string;
  student_id: string;
  student_name: string;
  registration: string;
  min_passing_grade: number;
  attendance_total_days: number;
  attendance_present_days: number;
  attendance_absent_days: number;
  attendance_percent: number;
  generated_at: string;
  periods: StudentFullReportPeriod[];
  subjects: StudentFullReportSubject[];
};

type SubjectItem = {
  id: string;
  name: string;
  code: string | null;
};

type TermItem = {
  id: string;
  name: string;
  school_year: number;
  sort_order: number;
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function GradebookPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classId, setClassId] = useState(searchParams.get("class_id") ?? "");
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [items, setItems] = useState<GradeItem[]>([]);
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

  async function loadTerms() {
    const token = requireToken();
    if (!token) return;
    const res = await fetch(`${API}/terms`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as TermItem[];
    setTerms(data);
    if (!termId && data.length > 0) setTermId(data[0].id);
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

  async function loadGradebook() {
    if (!classId || !termId || !subjectId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const token = requireToken();
    if (!token) return;

    const q = new URLSearchParams({ term_id: termId, subject_id: subjectId });
    const res = await fetch(`${API}/classes/${classId}/gradebook?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as GradebookResponse;
    setItems(data.items);
  }

  async function reload() {
    setError(null);
    setLoading(true);
    try {
      await Promise.all([loadClasses(), loadTerms(), loadSubjects()]);
      await loadGradebook();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  function updateItem(studentId: string, patch: Partial<GradeItem>) {
    setItems((prev) => prev.map((i) => (i.student_id === studentId ? { ...i, ...patch } : i)));
  }

  async function saveGradebook() {
    setError(null);
    if (!classId) return;
    const token = requireToken();
    if (!token) return;

    setBusy(true);
    try {
      const res = await fetch(`${API}/classes/${classId}/gradebook`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          term_id: termId,
          subject_id: subjectId,
          records: items.map((i) => ({
            student_id: i.student_id,
            score: i.score ?? 0,
            absences: i.absences ?? 0,
            comments: i.comments || null,
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadGradebook();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function buildReportHtml(report: GradebookReportResponse, schoolName: string) {
    const generatedAt = new Date(report.generated_at).toLocaleString("pt-BR");
    const rows = report.students
      .map((s) => {
        const score = s.score === null ? "-" : s.score.toFixed(1);
        const comments = s.comments ? escapeHtml(s.comments) : "-";
        return `
          <tr>
            <td>${escapeHtml(s.student_name)}</td>
            <td>${escapeHtml(s.registration)}</td>
            <td>${escapeHtml(report.subject_name)}</td>
            <td style="text-align:center">${score}</td>
            <td style="text-align:center">${s.absences_gradebook}</td>
            <td style="text-align:center">${s.attendance_present_days}/${s.attendance_total_days}</td>
            <td style="text-align:center">${s.attendance_percent.toFixed(1)}%</td>
            <td>${comments}</td>
          </tr>
        `;
      })
      .join("");

    return `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Boletim - ${escapeHtml(report.subject_name)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { margin: 2px 0; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th, td { border: 1px solid #cfcfcf; padding: 8px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; }
    .footer { margin-top: 14px; font-size: 11px; color: #555; }
  </style>
</head>
<body>
  <h1>Boletim de Notas e Presença</h1>
  <div class="meta"><strong>Escola:</strong> ${escapeHtml(schoolName || "Escola")}</div>
  <div class="meta"><strong>Turma:</strong> ${escapeHtml(report.class_grade)} - ${escapeHtml(report.class_name)} (${escapeHtml(report.class_period)})</div>
  <div class="meta"><strong>Ano:</strong> ${report.class_year} | <strong>Período letivo:</strong> ${escapeHtml(report.term_name)} | <strong>Disciplina:</strong> ${escapeHtml(report.subject_name)}</div>
  <div class="meta"><strong>Gerado em:</strong> ${escapeHtml(generatedAt)}</div>

  <table>
    <thead>
      <tr>
        <th>Aluno</th>
        <th>Matrícula</th>
        <th>Disciplina</th>
        <th>Nota</th>
        <th>Faltas (boletim)</th>
        <th>Presenças</th>
        <th>% Presença</th>
        <th>Comentários</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">Use "Salvar como PDF" na janela de impressão para enviar aos pais.</div>
</body>
</html>
    `;
  }

  function buildStudentReportHtml(
    report: StudentFullReportResponse,
    schoolName: string,
  ) {
    const generatedAt = new Date(report.generated_at).toLocaleString("pt-BR");
    const termCols = report.periods
      .map((p) => `<th>${escapeHtml(p.term_name)}</th>`)
      .join("");
    const subjectRows = report.subjects.map((s) => {
      const byTerm = new Map(s.period_grades.map((g) => [g.term_id, g]));
      const cells = report.periods
        .map((p) => {
          const g = byTerm.get(p.term_id);
          if (!g || g.score === null) return "<td style=\"text-align:center\">-</td>";
          return `<td style="text-align:center">${g.score.toFixed(1)}</td>`;
        })
        .join("");
      const avg = s.average_score === null ? "-" : s.average_score.toFixed(2);
      const statusClass = s.approved ? "color:#166534;font-weight:700" : "color:#991b1b;font-weight:700";
      return `<tr>
        <td>${escapeHtml(s.subject_name)}</td>
        ${cells}
        <td style="text-align:center">${avg}</td>
        <td style="${statusClass};text-align:center">${escapeHtml(s.status)}</td>
      </tr>`;
    }).join("");

    return `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Boletim - ${escapeHtml(report.student_name)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { margin: 2px 0; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th, td { border: 1px solid #cfcfcf; padding: 8px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; }
  </style>
</head>
<body>
  <h1>Boletim Individual - ${escapeHtml(report.student_name)}</h1>
  <div class="meta"><strong>Escola:</strong> ${escapeHtml(schoolName || "Escola")}</div>
  <div class="meta"><strong>Turma:</strong> ${escapeHtml(report.class_grade)} - ${escapeHtml(report.class_name)} (${escapeHtml(report.class_period)})</div>
  <div class="meta"><strong>Ano:</strong> ${report.class_year} | <strong>Média mínima para aprovação:</strong> ${report.min_passing_grade.toFixed(2)}</div>
  <div class="meta"><strong>Matrícula:</strong> ${escapeHtml(report.registration)}</div>
  <div class="meta"><strong>Gerado em:</strong> ${escapeHtml(generatedAt)}</div>

  <table>
    <thead>
      <tr>
        <th>Disciplina</th>
        ${termCols}
        <th>Média</th>
        <th>Situação</th>
      </tr>
    </thead>
    <tbody>
      ${subjectRows}
    </tbody>
  </table>
  <table style="margin-top:12px">
    <tbody>
      <tr><th style="width:220px">Presenças</th><td>${report.attendance_present_days}/${report.attendance_total_days}</td></tr>
      <tr><th>Ausências</th><td>${report.attendance_absent_days}</td></tr>
      <tr><th>Percentual de presença</th><td>${report.attendance_percent.toFixed(1)}%</td></tr>
    </tbody>
  </table>
</body>
</html>
    `;
  }

  async function fetchReportData(token: string) {
    const q = new URLSearchParams({ term_id: termId, subject_id: subjectId });
    const res = await fetch(`${API}/classes/${classId}/gradebook-report?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as GradebookReportResponse;
  }

  async function generatePdfReport() {
    setError(null);
    if (!classId || !termId || !subjectId) return;
    const token = requireToken();
    if (!token) return;

    setBusy(true);
    try {
      const report = await fetchReportData(token);

      const schoolName = localStorage.getItem("school_name") ?? localStorage.getItem("school_code") ?? "Escola";
      const html = buildReportHtml(report, schoolName);

      const popup = window.open("", "_blank");
      if (!popup) {
        throw new Error("Não foi possível abrir a janela de impressão. Libere pop-ups para este site.");
      }

      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function generateStudentPdf(studentId: string) {
    setError(null);
    if (!classId) return;
    const token = requireToken();
    if (!token) return;

    setBusy(true);
    try {
      const res = await fetch(`${API}/classes/${classId}/students/${studentId}/full-report`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const report = (await res.json()) as StudentFullReportResponse;

      const schoolName = localStorage.getItem("school_name") ?? localStorage.getItem("school_code") ?? "Escola";
      const html = buildStudentReportHtml(report, schoolName);

      const popup = window.open("", "_blank");
      if (!popup) {
        throw new Error("Não foi possível abrir a janela de impressão. Libere pop-ups para este site.");
      }

      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function copyParentLink(studentId: string) {
    setError(null);
    if (!classId) return;
    const token = requireToken();
    if (!token) return;

    setBusy(true);
    try {
      const res = await fetch(`${API}/classes/${classId}/students/${studentId}/full-report/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          expires_days: 30,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ShareReportResponse;
      const link = `${window.location.origin}/report/parent?token=${encodeURIComponent(data.token)}`;
      await navigator.clipboard.writeText(link);
      window.alert("Link do responsável copiado.");
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
    if (!classId || !termId || !subjectId) return;
    loadGradebook().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Erro inesperado"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, termId, subjectId]);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Boletim / Notas</h1>
            <p className="mt-2 text-sm text-neutral-600">Lançamento de notas por turma, disciplina e bimestre.</p>
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
                    {c.grade} - {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs font-medium text-neutral-600">Selecione a turma para lançar as notas.</p>
            </div>
            <div>
              <label className="text-sm font-bold text-neutral-950">Período letivo</label>
              <select
                className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
              >
                <option value="">Selecione</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} / {t.school_year}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs font-medium text-neutral-600">Período já cadastrado na tela Períodos.</p>
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
              <p className="mt-1 text-xs font-medium text-neutral-600">Disciplina cadastrada e vinculada ao professor.</p>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={reload}
                className="h-10 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 shadow hover:bg-neutral-100"
              >
                Atualizar
              </button>
              <button
                onClick={saveGradebook}
                disabled={busy || loading || !classId || !termId || !subjectId}
                className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow hover:bg-black disabled:opacity-60"
              >
                {busy ? "Salvando..." : "Salvar notas"}
              </button>
              <button
                onClick={generatePdfReport}
                disabled={busy || loading || !classId || !termId || !subjectId}
                className="h-10 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 shadow hover:bg-neutral-100 disabled:opacity-60"
              >
                Gerar PDF
              </button>
            </div>
          </div>

          {terms.length === 0 && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Cadastre um período letivo na tela Períodos para lançar notas.
            </div>
          )}
          {subjects.length === 0 && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Cadastre uma disciplina na tela Disciplinas para lançar notas.
            </div>
          )}

          <div className="mt-6 space-y-3">
            {loading && <div className="text-sm text-neutral-600">Carregando...</div>}
            {!loading && items.length === 0 && (
              <div className="text-sm text-neutral-600">Nenhum aluno nessa turma.</div>
            )}
            {items.map((i) => (
              <div key={i.student_id} className="rounded-2xl border border-neutral-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">{i.student_name}</div>
                    <div className="text-xs text-neutral-500">Matrícula: {i.registration}</div>
                    <div className="text-xs text-neutral-500">
                      Disciplina: {subjects.find((s) => s.id === subjectId)?.name ?? "-"}
                    </div>
                  </div>
                  <button
                    onClick={() => generateStudentPdf(i.student_id)}
                    disabled={busy || loading || !classId}
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-100 disabled:opacity-60"
                  >
                    PDF aluno
                  </button>
                  <button
                    onClick={() => copyParentLink(i.student_id)}
                    disabled={busy || loading || !classId}
                    className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-60"
                  >
                    Copiar link responsável
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700">Nota (0 a 10)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      className="mt-1 h-10 w-full rounded-xl border-2 border-neutral-700 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                      value={i.score ?? ""}
                      onChange={(e) =>
                        updateItem(i.student_id, {
                          score: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700">Faltas</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 h-10 w-full rounded-xl border-2 border-neutral-700 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                      value={i.absences ?? 0}
                      onChange={(e) => updateItem(i.student_id, { absences: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <textarea
                  className="mt-3 min-h-20 w-full rounded-2xl border-2 border-neutral-700 bg-white px-3 py-2 text-sm font-medium text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                  placeholder="Comentários (opcional)"
                  value={i.comments ?? ""}
                  onChange={(e) => updateItem(i.student_id, { comments: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
