"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Teacher = {
  id: string;
  tenant_id: string;
  person_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: string;
};

type Person = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role_codes?: string[];
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function TeachersPage() {
  const router = useRouter();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");

  function requireToken() {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      router.replace("/login");
      return null;
    }
    return token;
  }

  async function loadTeachers() {
    setError(null);
    setLoading(true);

    const token = requireToken();
    if (!token) return;

    try {
      const res = await fetch(`${API}/teachers`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro carregando professores");
      }

      setTeachers((await res.json()) as Teacher[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function loadPeopleByRole(nextRole: string) {
    const token = requireToken();
    if (!token) return;
    const roleCode = nextRole === "teacher" ? "teacher" : "staff";
    try {
      const res = await fetch(`${API}/people?person_type=${roleCode}&is_active=true`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      setPeople((await res.json()) as Person[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro carregando cadastros");
    }
  }

  async function createTeacher(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const token = requireToken();
    if (!token) return;

    const selectedPerson = availablePeople.find((p) => p.id === selectedPersonId);
    if (!selectedPerson) {
      setError("Selecione um cadastro de pessoa.");
      return;
    }
    const emailValue = (email || selectedPerson.email || "").trim().toLowerCase();
    if (!emailValue) {
      setError("Informe e-mail para acesso.");
      return;
    }
    if (password.trim().length < 8) {
      setError("Senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/teachers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          person_id: selectedPerson.id,
          full_name: selectedPerson.full_name,
          email: emailValue,
          password,
          phone: selectedPerson.phone || null,
          role,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro criando professor");
      }

      setEmail("");
      setSelectedPersonId("");
      setPassword("");
      setPeople([]);
      setRole("teacher");
      setEmail("");
      await loadPeopleByRole("teacher");
      await loadTeachers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function updateRole(userId: string, nextRole: string) {
    setError(null);

    const token = requireToken();
    if (!token) return;

    setBusy(true);
    try {
      const res = await fetch(`${API}/teachers/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro atualizando role");
      }

      await loadTeachers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTeacher(userId: string) {
    setError(null);

    const token = requireToken();
    if (!token) return;

    setBusy(true);
    try {
      const res = await fetch(`${API}/teachers/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro removendo professor");
      }

      await loadTeachers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadTeachers();
    loadPeopleByRole("teacher");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availablePeople = people
    .filter((p) => !teachers.some((t) => t.person_id === p.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Professores e Papéis</h1>
            <p className="mt-2 text-sm text-neutral-600">RBAC básico por tenant (owner/admin/teacher/staff).</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadTeachers}
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

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
              <h2 className="text-lg font-semibold tracking-tight">Novo usuário</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Selecione um cadastro existente para criar acesso de professor/equipe.
              </p>
              <form className="mt-4 space-y-4" onSubmit={createTeacher}>
                <div>
                  <label className="text-sm font-semibold text-neutral-900">Cadastro da pessoa</label>
                  <select
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-400 px-4 text-base text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                    value={selectedPersonId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedPersonId(nextId);
                      const selected = availablePeople.find((p) => p.id === nextId);
                      setEmail(selected?.email ?? "");
                    }}
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
                    <p className="mt-1 text-xs text-neutral-500">Nenhum cadastro disponível para este papel.</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-semibold text-neutral-900">E-mail</label>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-400 px-4 text-base text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                    placeholder="ex: prof@escola.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-neutral-900">Senha</label>
                  <input
                    type="password"
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-400 px-4 text-base text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                    placeholder="mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-neutral-900">Papel (Role)</label>
                  <select
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-400 px-4 text-base text-neutral-900 outline-none focus:ring-4 focus:ring-black/10"
                    value={role}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      setRole(nextRole);
                      setSelectedPersonId("");
                      setEmail("");
                      void loadPeopleByRole(nextRole);
                    }}
                    disabled={busy}
                  >
                    <option value="teacher">Professor (teacher)</option>
                    <option value="staff">Equipe (staff)</option>
                    <option value="admin">Administrador da escola (admin)</option>
                  </select>
                </div>
                <button
                  className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
                  disabled={busy}
                >
                  Criar usuário
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
              <div className="text-xs text-neutral-500">{loading ? "Carregando..." : `${teachers.length} usuário(s)`}</div>
              <div className="mt-4 grid gap-3">
                {teachers.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-neutral-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900">
                          {t.full_name ?? "Sem nome cadastrado"}
                        </div>
                        <div className="text-xs text-neutral-500">{t.email}</div>
                        {t.phone && <div className="text-xs text-neutral-500">Telefone: {t.phone}</div>}
                        <div className="text-xs text-neutral-500">Role atual: {t.role}</div>
                      </div>
                      <button
                        onClick={() => deleteTeacher(t.id)}
                        disabled={busy || t.role === "owner"}
                        className="rounded-2xl border-2 border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        Remover
                      </button>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {["teacher", "staff", "admin"].map((r) => (
                        <button
                          key={`${t.id}-${r}`}
                          onClick={() => updateRole(t.id, r)}
                          disabled={busy || t.role === "owner" || t.role === r}
                          className="rounded-2xl border-2 border-neutral-400 bg-white px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-100 disabled:opacity-60"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
