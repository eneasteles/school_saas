"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type SubjectGrade = {
  subject_id: string;
  subject_name: string;
  average_score: number | null;
  approved: boolean;
  status: string;
};

type PublicReportResponse = {
  student_name: string;
  registration: string;
  class_name: string;
  class_grade: string;
  class_year: number;
  class_period: string;
  min_passing_grade: number;
  attendance_total_days: number;
  attendance_present_days: number;
  attendance_absent_days: number;
  attendance_percent: number;
  generated_at: string;
  subjects: SubjectGrade[];
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function ParentReportPage() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [data, setData] = useState<PublicReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      if (!API) {
        setError("API não configurada.");
        setLoading(false);
        return;
      }
      if (!token) {
        setError("Link inválido (token ausente).");
        setLoading(false);
        return;
      }

      try {
        const q = new URLSearchParams({ token });
        const res = await fetch(`${API}/public/student-full-report?${q.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        setData((await res.json()) as PublicReportResponse);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro inesperado");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6 shadow">
        <h1 className="text-2xl font-semibold tracking-tight">Boletim do Aluno</h1>
        {loading && <p className="mt-4 text-sm text-neutral-600">Carregando...</p>}
        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className="mt-4 space-y-1 text-sm text-neutral-800">
              <div><strong>Aluno:</strong> {data.student_name}</div>
              <div><strong>Matrícula:</strong> {data.registration}</div>
              <div><strong>Turma:</strong> {data.class_grade} - {data.class_name} ({data.class_period})</div>
              <div><strong>Ano:</strong> {data.class_year}</div>
              <div><strong>Média mínima para aprovação:</strong> {data.min_passing_grade.toFixed(2)}</div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-300">
                    <th className="py-2 text-left">Disciplina</th>
                    <th className="py-2 text-left">Média</th>
                    <th className="py-2 text-left">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subjects.map((s) => (
                    <tr key={s.subject_id} className="border-b border-neutral-200">
                      <td className="py-2 text-neutral-900">{s.subject_name}</td>
                      <td className="py-2 text-neutral-900">{s.average_score === null ? "-" : s.average_score.toFixed(2)}</td>
                      <td
                        className={`py-2 font-semibold ${
                          s.average_score === null
                            ? "text-neutral-600"
                            : s.approved
                              ? "text-emerald-700"
                              : "text-red-700"
                        }`}
                      >
                        {s.status}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-neutral-200">
                    <td className="py-2 font-semibold text-neutral-700">Presenças</td>
                    <td className="py-2 text-neutral-900" colSpan={2}>
                      {data.attendance_present_days}/{data.attendance_total_days} ({data.attendance_percent.toFixed(1)}%)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 font-semibold text-neutral-700">Ausências</td>
                    <td className="py-2 text-neutral-900" colSpan={2}>{data.attendance_absent_days}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => window.print()}
                className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Salvar em PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
