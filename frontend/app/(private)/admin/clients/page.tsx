"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ClientStatus = "all" | "on_time" | "overdue";

type AdminClient = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  billing_due_date: string;
  payment_status: "on_time" | "overdue";
  days_overdue: number;
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function AdminClientsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [status, setStatus] = useState<ClientStatus>("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  function requirePlatformAuthOrRedirect() {
    const platformToken = localStorage.getItem("platform_token");
    if (!platformToken) {
      router.replace("/platform/login");
      return null;
    }
    return platformToken;
  }

  async function loadClients(nextStatus = status) {
    setError(null);
    setLoading(true);

    if (!API) {
      setError("NEXT_PUBLIC_API_BASE não está definido no .env.local");
      setLoading(false);
      return;
    }

    const platformToken = requirePlatformAuthOrRedirect();
    if (!platformToken) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/admin/clients?status=${nextStatus}`, {
        headers: {
          Authorization: `Bearer ${platformToken}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro ao carregar clientes");
      }

      setClients((await res.json()) as AdminClient[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function markPaid(tenantId: string) {
    setError(null);

    if (!API) {
      setError("NEXT_PUBLIC_API_BASE não está definido no .env.local");
      return;
    }

    const platformToken = requirePlatformAuthOrRedirect();
    if (!platformToken) return;

    setBusyId(tenantId);
    try {
      const res = await fetch(`${API}/admin/clients/${tenantId}/mark-paid`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${platformToken}`,
        },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro ao marcar pagamento");
      }

      await loadClients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusyId(null);
    }
  }

  function logoutPlatform() {
    localStorage.removeItem("platform_token");
    localStorage.removeItem("platform_role");
    router.push("/platform/login");
  }

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
  }

  useEffect(() => {
    if (!mounted) return;
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-6 shadow border border-neutral-200">
            <div className="text-sm text-neutral-600">Carregando...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin de Clientes (SaaS)</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Listagem de escolas em dia/atrasadas e baixa de pagamento.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => loadClients()}
              className="h-10 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-100"
            >
              Atualizar
            </button>
            <button
              onClick={logoutPlatform}
              className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow hover:bg-black"
            >
              Sair do Admin SaaS
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 rounded-2xl bg-white p-6 shadow border border-neutral-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Clientes</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-neutral-700">Status</label>
              <select
                className="h-10 rounded-2xl border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                value={status}
                onChange={(e) => {
                  const nextStatus = e.target.value as ClientStatus;
                  setStatus(nextStatus);
                  loadClients(nextStatus);
                }}
              >
                <option value="all">Todos</option>
                <option value="on_time">Em dia</option>
                <option value="overdue">Atrasadas</option>
              </select>
            </div>
          </div>

          <div className="mt-2 text-xs text-neutral-500">
            {loading ? "Carregando..." : `${clients.length} escola(s)`}
          </div>

          {!loading && clients.length === 0 && (
            <div className="mt-4 text-sm text-neutral-600">Nenhuma escola para esse filtro.</div>
          )}

          <div className="mt-4 grid gap-3">
            {clients.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 hover:bg-neutral-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">{c.name}</div>
                    <div className="mt-1 text-xs text-neutral-500">Slug: {c.slug}</div>
                    <div className="mt-1 text-xs text-neutral-500">ID: {c.id}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        c.payment_status === "overdue"
                          ? "bg-red-100 text-red-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {c.payment_status === "overdue" ? "Atrasada" : "Em dia"}
                    </div>
                    <div className="mt-2 text-xs text-neutral-500">
                      Vencimento: {formatDate(c.billing_due_date)}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {c.days_overdue > 0 ? `${c.days_overdue} dia(s) em atraso` : "Sem atraso"}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => markPaid(c.id)}
                    disabled={busyId === c.id}
                    className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                  >
                    {busyId === c.id ? "Atualizando..." : "Marcar pagamento (+30 dias)"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
