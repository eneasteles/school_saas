"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type TermItem = {
  id: string;
  tenant_id: string;
  name: string;
  school_year: number;
  sort_order: number;
  is_active: boolean;
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function TermsPage() {
  const router = useRouter();

  const [terms, setTerms] = useState<TermItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [schoolYear, setSchoolYear] = useState(String(new Date().getFullYear()));
  const [sortOrder, setSortOrder] = useState("1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSchoolYear, setEditSchoolYear] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("1");

  function requireToken() {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      router.replace("/login");
      return null;
    }
    return token;
  }

  async function loadTerms() {
    setError(null);
    setLoading(true);

    const token = requireToken();
    if (!token) return;

    try {
      const res = await fetch(`${API}/terms`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      setTerms((await res.json()) as TermItem[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function createTerm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const token = requireToken();
    if (!token) return;

    const yy = Number(schoolYear);
    const order = Number(sortOrder);
    if (!name.trim() || Number.isNaN(yy) || yy < 2000 || yy > 2100) {
      setError("Preencha nome e ano letivo válido.");
      return;
    }
    if (Number.isNaN(order) || order < 1) {
      setError("Ordem deve ser maior ou igual a 1.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/terms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          school_year: yy,
          sort_order: order,
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      setName("");
      setSortOrder("1");
      await loadTerms();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(term: TermItem) {
    setEditingId(term.id);
    setEditName(term.name);
    setEditSchoolYear(String(term.school_year));
    setEditSortOrder(String(term.sort_order));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditSchoolYear("");
    setEditSortOrder("1");
  }

  async function saveEdit(termId: string) {
    setError(null);
    const token = requireToken();
    if (!token) return;

    const yy = Number(editSchoolYear);
    const order = Number(editSortOrder);
    if (!editName.trim() || Number.isNaN(yy) || yy < 2000 || yy > 2100) {
      setError("Preencha nome e ano letivo válido.");
      return;
    }
    if (Number.isNaN(order) || order < 1) {
      setError("Ordem deve ser maior ou igual a 1.");
      return;
    }

    setBusyId(termId);
    try {
      const res = await fetch(`${API}/terms/${termId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          school_year: yy,
          sort_order: order,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      cancelEdit();
      await loadTerms();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(term: TermItem) {
    setError(null);
    const token = requireToken();
    if (!token) return;

    setBusyId(term.id);
    try {
      const res = await fetch(`${API}/terms/${term.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !term.is_active }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadTerms();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTerm(term: TermItem) {
    setError(null);
    const token = requireToken();
    if (!token) return;

    const ok = window.confirm(`Excluir o período "${term.name}"?`);
    if (!ok) return;

    setBusyId(term.id);
    try {
      const res = await fetch(`${API}/terms/${term.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      if (editingId === term.id) cancelEdit();
      await loadTerms();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    loadTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Períodos Letivos</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Cadastre bimestres/trimestres para uso no boletim.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadTerms} className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow hover:bg-black">
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
              <h2 className="text-lg font-semibold tracking-tight">Novo período</h2>
              <p className="mt-2 text-sm font-medium text-neutral-700">
                Preencha os campos abaixo. Todos são usados no lançamento do boletim.
              </p>
              <form className="mt-4 space-y-4" onSubmit={createTerm}>
                <div>
                  <label className="text-sm font-bold text-neutral-950">Nome do período</label>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-semibold text-neutral-950 placeholder:text-neutral-500 outline-none focus:ring-4 focus:ring-black/10"
                    placeholder="ex: 1º Bimestre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                  />
                  <p className="mt-1 text-xs font-medium text-neutral-600">Exemplo: 1º Bimestre, 2º Trimestre.</p>
                </div>
                <div>
                  <label className="text-sm font-bold text-neutral-950">Ano letivo</label>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-semibold text-neutral-950 placeholder:text-neutral-500 outline-none focus:ring-4 focus:ring-black/10"
                    placeholder="ex: 2026"
                    value={schoolYear}
                    onChange={(e) => setSchoolYear(e.target.value)}
                    disabled={busy}
                  />
                  <p className="mt-1 text-xs font-medium text-neutral-600">Ano ao qual o período pertence.</p>
                </div>
                <div>
                  <label className="text-sm font-bold text-neutral-950">Ordem</label>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-700 bg-white px-4 text-base font-semibold text-neutral-950 placeholder:text-neutral-500 outline-none focus:ring-4 focus:ring-black/10"
                    placeholder="ex: 1"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    disabled={busy}
                  />
                  <p className="mt-1 text-xs font-medium text-neutral-600">
                    Define a sequência de exibição (1, 2, 3...).
                  </p>
                </div>
                <button
                  className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
                  disabled={busy}
                >
                  Cadastrar período
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
              <div className="text-xs text-neutral-500">{loading ? "Carregando..." : `${terms.length} período(s)`}</div>
              <div className="mt-4 grid gap-3">
                {terms.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-neutral-200 p-4">
                    {editingId === t.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-neutral-800">Nome do período</label>
                          <input
                            className="mt-1 h-10 w-full rounded-xl border-2 border-neutral-700 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={busyId === t.id}
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-semibold text-neutral-800">Ano letivo</label>
                            <input
                              className="mt-1 h-10 w-full rounded-xl border-2 border-neutral-700 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                              value={editSchoolYear}
                              onChange={(e) => setEditSchoolYear(e.target.value)}
                              disabled={busyId === t.id}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-neutral-800">Ordem</label>
                            <input
                              className="mt-1 h-10 w-full rounded-xl border-2 border-neutral-700 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus:ring-4 focus:ring-black/10"
                              value={editSortOrder}
                              onChange={(e) => setEditSortOrder(e.target.value)}
                              disabled={busyId === t.id}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(t.id)}
                            disabled={busyId === t.id}
                            className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={busyId === t.id}
                            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-neutral-900">{t.name}</div>
                          <span
                            className={
                              t.is_active
                                ? "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase text-emerald-800"
                                : "rounded-full bg-neutral-200 px-2 py-1 text-[10px] font-bold uppercase text-neutral-700"
                            }
                          >
                            {t.is_active ? "Ativo" : "Desabilitado"}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500">
                          Ano: {t.school_year} | Ordem: {t.sort_order}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => startEdit(t)}
                            disabled={busyId === t.id}
                            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => toggleActive(t)}
                            disabled={busyId === t.id}
                            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                          >
                            {t.is_active ? "Desabilitar" : "Reativar"}
                          </button>
                          <button
                            onClick={() => deleteTerm(t)}
                            disabled={busyId === t.id}
                            className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                          >
                            Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {!loading && terms.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
                    Nenhum período cadastrado.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
