"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Person = {
  id: string;
  tenant_id: string;
  person_type: string;
  role_codes?: string[];
  full_name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  notes: string | null;
  is_active: boolean;
};

type PartialCreateRefs = {
  personId?: string;
};

const API = process.env.NEXT_PUBLIC_API_BASE;

const TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "student", label: "Alunos" },
  { value: "parent", label: "Pais/Mães" },
  { value: "financial_guardian", label: "Responsável Financeiro" },
  { value: "guardian", label: "Resp. Vinculado ao Aluno" },
  { value: "teacher", label: "Professores" },
  { value: "staff", label: "Funcionários" },
  { value: "supplier", label: "Fornecedores" },
];

const UNIFIED_CREATE_ROLE_OPTIONS = [
  { value: "student", label: "Aluno" },
  { value: "parent", label: "Pai/Mãe" },
  { value: "financial_guardian", label: "Responsável Financeiro" },
  { value: "guardian", label: "Resp. Vinculado ao Aluno" },
  { value: "teacher", label: "Professor" },
  { value: "staff", label: "Funcionário/Equipe" },
  { value: "supplier", label: "Fornecedor" },
];

const ROLE_MANAGE_OPTIONS = [
  { value: "parent", label: "Pai/Mãe" },
  { value: "financial_guardian", label: "Responsável Financeiro" },
  { value: "supplier", label: "Fornecedor" },
  { value: "guardian", label: "Resp. Vinculado ao Aluno" },
  { value: "teacher", label: "Professor" },
  { value: "staff", label: "Funcionário/Equipe" },
  { value: "student", label: "Aluno" },
];

export default function CadastrosPage() {
  const router = useRouter();
  const [items, setItems] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [personType, setPersonType] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<"" | "true" | "false">("");

  const [createRoles, setCreateRoles] = useState<string[]>(["parent"]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [notes, setNotes] = useState("");
  const [extraStudentRegistration, setExtraStudentRegistration] = useState("");
  const [extraStudentBirthDate, setExtraStudentBirthDate] = useState("");
  const [extraTeacherArea, setExtraTeacherArea] = useState("");
  const [extraSupplierCategory, setExtraSupplierCategory] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDocument, setEditDocument] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editOriginalRoles, setEditOriginalRoles] = useState<string[]>([]);
  const [roleSelectionByPerson, setRoleSelectionByPerson] = useState<Record<string, string>>({});

  function requireToken() {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      router.replace("/login");
      return null;
    }
    return token;
  }

  async function loadPeople() {
    setLoading(true);
    setError(null);
    const token = requireToken();
    if (!token) return;

    try {
      const params = new URLSearchParams();
      if (personType) params.set("person_type", personType);
      if (search.trim()) params.set("q", search.trim());
      if (isActiveFilter) params.set("is_active", isActiveFilter);

      const qs = params.toString();
      const res = await fetch(`${API}/people${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      setItems((await res.json()) as Person[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function createPerson(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = requireToken();
    if (!token) return;

    if (fullName.trim().length < 2) {
      setError("Informe o nome completo.");
      return;
    }
    if (createRoles.length === 0) {
      setError("Selecione ao menos um tipo de cadastro.");
      return;
    }
    if (createRoles.includes("student") && !extraStudentRegistration.trim()) {
      setError("Para cadastro de aluno, informe a matrícula (use o botão Sugerir).");
      return;
    }
    setBusy(true);
    const refs: PartialCreateRefs = {};
    try {
      const primaryRole = createRoles[0];
      const extras = buildExtraNotes({
        roles: createRoles,
        extraStudentRegistration,
        extraStudentBirthDate,
        extraTeacherArea,
        extraSupplierCategory,
      });
      const notesPayload = [notes.trim(), extras].filter((v) => v.length > 0).join("\n\n");
      const res = await fetch(`${API}/people`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          person_type: primaryRole,
          full_name: fullName.trim(),
          email: email || null,
          phone: phone || null,
          document: document || null,
          notes: notesPayload || null,
          is_active: true,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = (await res.json()) as Person;
      refs.personId = created.id;

      const additionalRoles = createRoles.filter((r) => r !== primaryRole);
      for (const roleCode of additionalRoles) {
        const roleRes = await fetch(`${API}/people/${created.id}/roles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role_code: roleCode }),
        });
        if (!roleRes.ok) throw new Error(await roleRes.text());
      }

      setFullName("");
      setEmail("");
      setPhone("");
      setDocument("");
      setNotes("");
      setCreateRoles(["parent"]);
      setExtraStudentRegistration("");
      setExtraStudentBirthDate("");
      setExtraTeacherArea("");
      setExtraSupplierCategory("");
      await loadPeople();
    } catch (err: unknown) {
      if (token) {
        await rollbackPartialCreate(token, refs);
      }
      setError(err instanceof Error ? err.message : "Erro inesperado (cadastro desfeito automaticamente)");
    } finally {
      setBusy(false);
    }
  }

  async function rollbackPartialCreate(token: string, refs: PartialCreateRefs) {
    const actions: Array<{ url: string; method: "DELETE" }> = [];
    if (refs.personId) actions.push({ url: `${API}/people/${refs.personId}`, method: "DELETE" });

    for (const action of actions) {
      try {
        await fetch(action.url, {
          method: action.method,
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Best effort rollback.
      }
    }
  }

  function startEdit(person: Person) {
    setEditingId(person.id);
    setEditName(person.full_name);
    setEditEmail(person.email ?? "");
    setEditPhone(person.phone ?? "");
    setEditDocument(person.document ?? "");
    setEditNotes(person.notes ?? "");
    setEditActive(person.is_active);
    const roles = person.role_codes?.length ? person.role_codes : [person.person_type];
    setEditRoles(roles);
    setEditOriginalRoles(roles);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditRoles([]);
    setEditOriginalRoles([]);
  }

  async function saveEdit(personId: string) {
    setError(null);
    const token = requireToken();
    if (!token) return;
    if (editName.trim().length < 2) {
      setError("Informe o nome completo.");
      return;
    }
    if (editRoles.length === 0) {
      setError("Selecione ao menos um papel para a pessoa.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/people/${personId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: editName.trim(),
          email: editEmail || null,
          phone: editPhone || null,
          document: editDocument || null,
          notes: editNotes || null,
          is_active: editActive,
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      const rolesToAdd = editRoles.filter((r) => !editOriginalRoles.includes(r));
      const rolesToRemove = editOriginalRoles.filter((r) => !editRoles.includes(r));

      for (const roleCode of rolesToAdd) {
        const addRes = await fetch(`${API}/people/${personId}/roles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role_code: roleCode }),
        });
        if (!addRes.ok) throw new Error(await addRes.text());
      }

      for (const roleCode of rolesToRemove) {
        const removeRes = await fetch(`${API}/people/${personId}/roles/${roleCode}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!removeRes.ok) throw new Error(await removeRes.text());
      }

      setEditingId(null);
      setEditRoles([]);
      setEditOriginalRoles([]);
      await loadPeople();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function removePerson(personId: string) {
    if (!window.confirm("Excluir este cadastro?")) return;
    setError(null);
    const token = requireToken();
    if (!token) return;

    setBusy(true);
    try {
      const res = await fetch(`${API}/people/${personId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      if (editingId === personId) setEditingId(null);
      await loadPeople();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function addRole(personId: string) {
    setError(null);
    const token = requireToken();
    if (!token) return;
    const roleCode = roleSelectionByPerson[personId];
    if (!roleCode) {
      setError("Selecione um papel para adicionar.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/people/${personId}/roles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role_code: roleCode }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadPeople();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function removeRole(personId: string, roleCode: string) {
    setError(null);
    const token = requireToken();
    if (!token) return;

    setBusy(true);
    try {
      const res = await fetch(`${API}/people/${personId}/roles/${roleCode}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      await loadPeople();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function suggestStudentRegistration() {
    const token = requireToken();
    if (!token) return;
    try {
      const suggestion = await fetchRegistrationSuggestion(token);
      if (suggestion) {
        setExtraStudentRegistration((current) => (current.trim().length > 0 ? current : suggestion));
      }
    } catch {
      // noop
    }
  }

  useEffect(() => {
    void loadPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personType, isActiveFilter]);

  function toggleCreateRole(roleCode: string) {
    setCreateRoles((prev) => {
      if (prev.includes(roleCode)) return prev.filter((r) => r !== roleCode);
      if (roleCode === "teacher") return [...prev.filter((r) => r !== "staff"), "teacher"];
      if (roleCode === "staff") return [...prev.filter((r) => r !== "teacher"), "staff"];
      return [...prev, roleCode];
    });
  }

  function toggleEditRole(roleCode: string) {
    setEditRoles((prev) => {
      if (prev.includes(roleCode)) return prev.filter((r) => r !== roleCode);
      return [...prev, roleCode];
    });
  }

  const hasStudentRole = createRoles.includes("student");
  const hasGuardianRole = createRoles.includes("guardian");
  const hasTeacherOrStaffRole = createRoles.includes("teacher") || createRoles.includes("staff");
  const hasSupplierRole = createRoles.includes("supplier");

  const counters = useMemo(() => {
    const initial: Record<string, number> = {
      student: 0,
      parent: 0,
      financial_guardian: 0,
      guardian: 0,
      teacher: 0,
      staff: 0,
      supplier: 0,
    };
    items.forEach((i) => {
      const roles = i.role_codes?.length ? i.role_codes : [i.person_type];
      const uniqueRoles = Array.from(new Set(roles));
      uniqueRoles.forEach((role) => {
        initial[role] = (initial[role] ?? 0) + 1;
      });
    });
    return initial;
  }, [items]);

  useEffect(() => {
    if (!hasStudentRole || extraStudentRegistration.trim().length > 0) return;
    void suggestStudentRegistration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStudentRole]);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cadastros Unificados</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Busca geral de alunos, pais, responsável financeiro, responsáveis vinculados, professores, funcionários e fornecedores.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadPeople} className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow hover:bg-black">
              Atualizar
            </button>
          </div>
        </div>

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
          <Counter title="Alunos" value={counters.student ?? 0} />
          <Counter title="Pais/Mães" value={counters.parent ?? 0} />
          <Counter title="Resp. Financeiro" value={counters.financial_guardian ?? 0} />
          <Counter title="Resp. Vinculado" value={counters.guardian ?? 0} />
          <Counter title="Professores" value={counters.teacher ?? 0} />
          <Counter title="Funcionários" value={counters.staff ?? 0} />
          <Counter title="Fornecedores" value={counters.supplier ?? 0} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow">
            <h2 className="text-base font-semibold">Filtros</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-700">Busca</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadPeople();
                  }}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  placeholder="Nome, e-mail ou documento"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Tipo</label>
                <select
                  value={personType}
                  onChange={(e) => setPersonType(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Status</label>
                <select
                  value={isActiveFilter}
                  onChange={(e) => setIsActiveFilter(e.target.value as "" | "true" | "false")}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>
              <button
                onClick={loadPeople}
                className="w-full rounded-xl bg-neutral-900 py-2 text-sm font-semibold text-white"
              >
                Pesquisar
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow lg:col-span-2">
            <h2 className="text-base font-semibold">Cadastro único de pessoa</h2>
            <p className="mt-1 text-xs text-neutral-600">
              Um único formulário para todas as pessoas. Os campos complementares aparecem conforme o tipo selecionado.
            </p>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createPerson}>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-neutral-700">Tipos da pessoa</label>
                <div className="mt-2 grid gap-2 rounded-xl border border-neutral-200 p-3 md:grid-cols-2">
                  {UNIFIED_CREATE_ROLE_OPTIONS.map((role) => (
                    <label key={role.value} className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                      <input
                        type="checkbox"
                        checked={createRoles.includes(role.value)}
                        onChange={() => toggleCreateRole(role.value)}
                      />
                      {role.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Nome</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">E-mail</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Telefone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Documento</label>
                <input
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Observações</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                />
              </div>
              {hasStudentRole && (
                <>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-blue-700">Complemento de Aluno: Matrícula</label>
                      <button
                        type="button"
                        onClick={suggestStudentRegistration}
                        disabled={busy}
                        className="rounded-xl border border-blue-200 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                      >
                        Sugerir
                      </button>
                    </div>
                    <input
                      value={extraStudentRegistration}
                      onChange={(e) => setExtraStudentRegistration(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm"
                      placeholder="Ex: 2026-001"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-blue-700">Complemento de Aluno: Nascimento</label>
                    <input
                      type="date"
                      value={extraStudentBirthDate}
                      onChange={(e) => setExtraStudentBirthDate(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm"
                    />
                  </div>
                </>
              )}
              {hasGuardianRole && (
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-emerald-700">Complemento de Resp. Vinculado</label>
                  <div className="mt-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    Após salvar o cadastro, faça os vínculos de alunos no módulo `Resp. Vinculados`.
                  </div>
                </div>
              )}
              {hasTeacherOrStaffRole && (
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-violet-700">Complemento de Professor/Equipe: Área/Função</label>
                  <input
                    value={extraTeacherArea}
                    onChange={(e) => setExtraTeacherArea(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-violet-200 bg-violet-50 px-3 text-sm"
                    placeholder="Ex: Matemática, Secretaria, Coordenação"
                  />
                  <div className="mt-2 text-xs text-violet-900">
                    A criação de acesso (e senha) é feita no módulo `Professores`.
                  </div>
                </div>
              )}
              {hasSupplierRole && (
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-amber-700">Complemento de Fornecedor: Categoria</label>
                  <input
                    value={extraSupplierCategory}
                    onChange={(e) => setExtraSupplierCategory(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm"
                    placeholder="Ex: Alimentação, Uniforme, Limpeza"
                  />
                </div>
              )}
              <div className="md:col-span-2">
                <button
                  disabled={busy}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-800 disabled:opacity-60"
                >
                  {busy ? "Salvando..." : "Salvar cadastro"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Registros</h2>
            <span className="text-xs text-neutral-500">{loading ? "Carregando..." : `${items.length} registro(s)`}</span>
          </div>
          <div className="space-y-3">
            {!loading && items.length === 0 && <div className="text-sm text-neutral-600">Nenhum cadastro encontrado.</div>}
            {items.map((person) => {
              const isEditing = editingId === person.id;
              const roles = person.role_codes ?? [person.person_type];
              const canDeleteFromUnified =
                roles.includes("parent") ||
                roles.includes("supplier") ||
                roles.includes("financial_guardian");
              return (
                <div key={person.id} className="rounded-xl border border-neutral-200 p-4">
                  {!isEditing && (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-neutral-900">{person.full_name}</div>
                          <div className="text-xs text-neutral-600">
                            {typeLabel(person.person_type)} • {person.is_active ? "Ativo" : "Inativo"}
                          </div>
                          {roles.length > 1 && (
                            <div className="mt-1 text-[11px] text-neutral-500">
                              Papéis: {roles.map((r) => typeLabel(r)).join(", ")}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(person)}
                            className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => removePerson(person.id)}
                            disabled={!canDeleteFromUnified}
                            className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-neutral-600 md:grid-cols-2">
                        <div>E-mail: {person.email || "-"}</div>
                        <div>Telefone: {person.phone || "-"}</div>
                        <div>Documento: {person.document || "-"}</div>
                        <div>Obs: {person.notes || "-"}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <select
                          value={roleSelectionByPerson[person.id] ?? ""}
                          onChange={(e) =>
                            setRoleSelectionByPerson((prev) => ({ ...prev, [person.id]: e.target.value }))
                          }
                          className="h-9 rounded-lg border border-neutral-300 px-2 text-xs font-semibold text-neutral-800"
                        >
                          <option value="">Adicionar papel...</option>
                          {ROLE_MANAGE_OPTIONS.filter((opt) => !roles.includes(opt.value)).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => addRole(person.id)}
                          disabled={busy || !roleSelectionByPerson[person.id]}
                          className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 disabled:opacity-60"
                        >
                          Adicionar papel
                        </button>
                        {roles.map((role) => (
                          <button
                            key={`${person.id}-${role}`}
                            onClick={() => removeRole(person.id, role)}
                            disabled={busy}
                            className="h-9 rounded-lg border border-neutral-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                          >
                            Remover {typeLabel(role)}
                          </button>
                        ))}
                      </div>
                      {!canDeleteFromUnified && (
                        <div className="mt-2 text-xs text-neutral-500">
                          Excluir esse tipo deve ser feito no módulo específico.
                        </div>
                      )}
                    </>
                  )}

                  {isEditing && (
                    <div className="grid gap-2 md:grid-cols-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10 rounded-lg border border-neutral-300 px-3 text-sm" />
                      <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-10 rounded-lg border border-neutral-300 px-3 text-sm" placeholder="E-mail" />
                      <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-10 rounded-lg border border-neutral-300 px-3 text-sm" placeholder="Telefone" />
                      <input value={editDocument} onChange={(e) => setEditDocument(e.target.value)} className="h-10 rounded-lg border border-neutral-300 px-3 text-sm" placeholder="Documento" />
                      <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="h-10 rounded-lg border border-neutral-300 px-3 text-sm md:col-span-2" placeholder="Observações" />
                      <div className="rounded-lg border border-neutral-200 p-3 md:col-span-2">
                        <div className="mb-2 text-xs font-semibold text-neutral-700">Papéis da pessoa</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {ROLE_MANAGE_OPTIONS.map((role) => (
                            <label key={`edit-role-${role.value}`} className="flex items-center gap-2 text-xs text-neutral-800">
                              <input
                                type="checkbox"
                                checked={editRoles.includes(role.value)}
                                onChange={() => toggleEditRole(role.value)}
                              />
                              {role.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700 md:col-span-2">
                        <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                        Cadastro ativo
                      </label>
                      <div className="flex gap-2 md:col-span-2">
                        <button
                          onClick={() => saveEdit(person.id)}
                          className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Counter({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow">
      <div className="text-xs font-semibold text-neutral-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function typeLabel(personType: string) {
  const found = TYPE_OPTIONS.find((o) => o.value === personType);
  return found?.label ?? personType;
}

async function fetchRegistrationSuggestion(token: string): Promise<string | null> {
  if (!API) return null;
  const res = await fetch(`${API}/students/registration-suggestion`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { registration?: string };
  return data.registration ?? null;
}

function buildExtraNotes({
  roles,
  extraStudentRegistration,
  extraStudentBirthDate,
  extraTeacherArea,
  extraSupplierCategory,
}: {
  roles: string[];
  extraStudentRegistration: string;
  extraStudentBirthDate: string;
  extraTeacherArea: string;
  extraSupplierCategory: string;
}) {
  const lines: string[] = [];
  lines.push(`Tipos selecionados: ${roles.map((r) => typeLabel(r)).join(", ")}`);
  if (roles.includes("student")) {
    if (extraStudentRegistration.trim()) lines.push(`Aluno - matrícula: ${extraStudentRegistration.trim()}`);
    if (extraStudentBirthDate.trim()) lines.push(`Aluno - nascimento: ${extraStudentBirthDate.trim()}`);
  }
  if ((roles.includes("teacher") || roles.includes("staff")) && extraTeacherArea.trim()) {
    lines.push(`Professor/Equipe - área/função: ${extraTeacherArea.trim()}`);
  }
  if (roles.includes("supplier") && extraSupplierCategory.trim()) {
    lines.push(`Fornecedor - categoria: ${extraSupplierCategory.trim()}`);
  }
  return lines.join("\n");
}
