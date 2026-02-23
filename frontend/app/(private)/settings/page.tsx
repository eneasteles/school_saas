"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SchoolSettings = {
  tenant_id: string;
  school_name: string;
  school_code: string;
  passing_min_grade: number;
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function SchoolSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SchoolSettings | null>(null);
  const [passingMinGrade, setPassingMinGrade] = useState("");

  function requireToken() {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      router.replace("/login");
      return null;
    }
    return token;
  }

  async function loadSettings() {
    setLoading(true);
    setError(null);
    const token = requireToken();
    if (!token) return;

    try {
      const res = await fetch(`${API}/school/settings`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const payload = (await res.json()) as SchoolSettings;
      setData(payload);
      setPassingMinGrade(payload.passing_min_grade.toFixed(2));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setError(null);
    const token = requireToken();
    if (!token) return;

    const value = Number(passingMinGrade);
    if (Number.isNaN(value) || value < 0 || value > 10) {
      setError("Média mínima deve estar entre 0 e 10.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/school/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ passing_min_grade: value }),
      });
      if (!res.ok) throw new Error(await res.text());
      const payload = (await res.json()) as SchoolSettings;
      setData(payload);
      setPassingMinGrade(payload.passing_min_grade.toFixed(2));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Configurações da Escola</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Defina regras pedagógicas da própria escola.
            </p>
          </div>
          <div />
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow">
          {loading && <div className="text-sm text-neutral-600">Carregando...</div>}
          {!loading && data && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-neutral-950">Escola</label>
                <div className="mt-2 text-sm text-neutral-800">
                  {data.school_name} ({data.school_code})
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-950">Média mínima para aprovação</label>
                <input
                  value={passingMinGrade}
                  onChange={(e) => setPassingMinGrade(e.target.value)}
                  className="mt-2 h-12 w-44 rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-semibold text-neutral-950"
                />
                <p className="mt-1 text-xs text-neutral-600">
                  Valor usado no boletim para indicar Aprovado/Reprovado por disciplina.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={saveSettings}
                  disabled={busy}
                  className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow hover:bg-black disabled:opacity-60"
                >
                  {busy ? "Salvando..." : "Salvar"}
                </button>
                <button
                  onClick={loadSettings}
                  className="h-10 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 shadow hover:bg-neutral-100"
                >
                  Recarregar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
