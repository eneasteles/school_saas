"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardSummary = {
  students_total: number;
  classes_total: number;
  teachers_total: number;
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setError(null);
    setLoading(true);

    const token = localStorage.getItem("token");
    if (!token || !API) {
      router.replace("/login");
      return;
    }

    try {
      const res = await fetch(`${API}/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro ao carregar dashboard");
      }

      setData((await res.json()) as DashboardSummary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartMetrics = [
    {
      label: "Alunos",
      value: data?.students_total ?? 0,
      color: "#1d4ed8",
    },
    {
      label: "Turmas",
      value: data?.classes_total ?? 0,
      color: "#0f766e",
    },
    {
      label: "Professores",
      value: data?.teachers_total ?? 0,
      color: "#92400e",
    },
  ];

  const totalChart = chartMetrics.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-2 text-sm text-neutral-600">Visão inicial da operação da escola.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadDashboard}
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard title="Alunos" value={loading ? "..." : String(data?.students_total ?? 0)} />
          <MetricCard title="Turmas" value={loading ? "..." : String(data?.classes_total ?? 0)} />
          <MetricCard title="Professores/Equipe" value={loading ? "..." : String(data?.teachers_total ?? 0)} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow lg:col-span-2">
            <h2 className="text-base font-semibold text-neutral-900">Indicadores em barras</h2>
            <p className="mt-1 text-xs text-neutral-600">Comparativo rápido entre os principais números.</p>
            <div className="mt-4 space-y-3">
              {loading && <div className="text-sm text-neutral-600">Carregando gráfico...</div>}
              {!loading &&
                chartMetrics.map((item) => (
                  <BarLine
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    max={Math.max(...chartMetrics.map((m) => m.value), 1)}
                    color={item.color}
                  />
                ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow">
            <h2 className="text-base font-semibold text-neutral-900">Distribuição</h2>
            <p className="mt-1 text-xs text-neutral-600">Participação relativa dos indicadores.</p>
            <div className="mt-4 flex items-center justify-center">
              {loading ? (
                <div className="text-sm text-neutral-600">Carregando gráfico...</div>
              ) : (
                <DonutChart metrics={chartMetrics} total={totalChart} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow">
      <div className="text-xs font-semibold text-neutral-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">{value}</div>
    </div>
  );
}

function BarLine({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const percent = Math.max(4, (value / Math.max(max, 1)) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-neutral-700">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function DonutChart({
  metrics,
  total,
}: {
  metrics: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  if (total <= 0) {
    return <div className="text-sm text-neutral-600">Sem dados para distribuição.</div>;
  }

  const segments = metrics
    .reduce(
      (acc, m) => {
        const pct = (m.value / total) * 100;
        const start = acc.cumulative;
        const end = start + pct;
        acc.parts.push(`${m.color} ${start}% ${end}%`);
        return { cumulative: end, parts: acc.parts };
      },
      { cumulative: 0, parts: [] as string[] },
    )
    .parts.join(", ");

  return (
    <div className="w-full">
      <div
        className="mx-auto h-40 w-40 rounded-full"
        style={{ background: `conic-gradient(${segments})` }}
      />
      <div className="mt-4 space-y-1">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between text-xs text-neutral-700">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: m.color }} />
              <span>{m.label}</span>
            </div>
            <span>{((m.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
