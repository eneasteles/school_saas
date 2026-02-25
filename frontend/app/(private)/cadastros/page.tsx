"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Person = {
  id: string;
  tenant_id: string;
  person_type: string;
  role_codes?: string[];
  full_name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  photo_url?: string | null;
  zip_code: string | null;
  street: string | null;
  address_number: string | null;
  neighborhood: string | null;
  complement: string | null;
  state_ibge_code: number | null;
  state_uf: string | null;
  state_name: string | null;
  city_ibge_code: number | null;
  city_name: string | null;
  parent_student_ids?: string[];
  pickup_student_ids?: string[];
  financial_student_ids?: string[];
  notes: string | null;
  is_active: boolean;
};

type StudentLite = {
  id: string;
  name: string;
  registration: string;
};

type IbgeState = {
  id: number;
  sigla: string;
  nome: string;
};

type IbgeCity = {
  id: number;
  nome: string;
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  erro?: boolean;
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
  { value: "pickup_authorized", label: "Autorizado para Buscar Aluno" },
  { value: "guardian", label: "Resp. Vinculado ao Aluno" },
  { value: "teacher", label: "Professores" },
  { value: "staff", label: "Funcionários" },
  { value: "supplier", label: "Fornecedores" },
];

const UNIFIED_CREATE_ROLE_OPTIONS = [
  { value: "student", label: "Aluno" },
  { value: "parent", label: "Pai/Mãe" },
  { value: "financial_guardian", label: "Responsável Financeiro" },
  { value: "pickup_authorized", label: "Autorizado para Buscar Aluno" },
  { value: "guardian", label: "Resp. Vinculado ao Aluno" },
  { value: "teacher", label: "Professor" },
  { value: "staff", label: "Funcionário/Equipe" },
  { value: "supplier", label: "Fornecedor" },
];

const ROLE_MANAGE_OPTIONS = [
  { value: "parent", label: "Pai/Mãe" },
  { value: "financial_guardian", label: "Responsável Financeiro" },
  { value: "pickup_authorized", label: "Autorizado para Buscar Aluno" },
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
  const [photoUrl, setPhotoUrl] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [complement, setComplement] = useState("");
  const [stateIbgeCode, setStateIbgeCode] = useState<string>("");
  const [stateUf, setStateUf] = useState("");
  const [stateName, setStateName] = useState("");
  const [cityIbgeCode, setCityIbgeCode] = useState<string>("");
  const [cityName, setCityName] = useState("");
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
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [editZipCode, setEditZipCode] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editAddressNumber, setEditAddressNumber] = useState("");
  const [editNeighborhood, setEditNeighborhood] = useState("");
  const [editComplement, setEditComplement] = useState("");
  const [editStateIbgeCode, setEditStateIbgeCode] = useState<string>("");
  const [editStateUf, setEditStateUf] = useState("");
  const [editStateName, setEditStateName] = useState("");
  const [editCityIbgeCode, setEditCityIbgeCode] = useState<string>("");
  const [editCityName, setEditCityName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editOriginalRoles, setEditOriginalRoles] = useState<string[]>([]);
  const [roleSelectionByPerson, setRoleSelectionByPerson] = useState<Record<string, string>>({});
  const [ibgeStates, setIbgeStates] = useState<IbgeState[]>([]);
  const [cities, setCities] = useState<IbgeCity[]>([]);
  const [editCities, setEditCities] = useState<IbgeCity[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [parentStudentIds, setParentStudentIds] = useState<string[]>([]);
  const [editParentStudentIds, setEditParentStudentIds] = useState<string[]>([]);
  const [pickupStudentIds, setPickupStudentIds] = useState<string[]>([]);
  const [editPickupStudentIds, setEditPickupStudentIds] = useState<string[]>([]);
  const [financialStudentIds, setFinancialStudentIds] = useState<string[]>([]);
  const [editFinancialStudentIds, setEditFinancialStudentIds] = useState<string[]>([]);
  const [parentStudentSearch, setParentStudentSearch] = useState("");
  const [editParentStudentSearch, setEditParentStudentSearch] = useState("");
  const [pickupStudentSearch, setPickupStudentSearch] = useState("");
  const [editPickupStudentSearch, setEditPickupStudentSearch] = useState("");
  const [financialStudentSearch, setFinancialStudentSearch] = useState("");
  const [editFinancialStudentSearch, setEditFinancialStudentSearch] = useState("");

  function requireToken() {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      router.replace("/login");
      return null;
    }
    return token;
  }

  async function loadIbgeStates() {
    const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Falha ao carregar estados");
    const data = (await res.json()) as IbgeState[];
    setIbgeStates(data);
  }

  async function loadCitiesByUf(uf: string, target: "create" | "edit") {
    if (!uf) {
      if (target === "create") setCities([]);
      if (target === "edit") setEditCities([]);
      return;
    }
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Falha ao carregar cidades");
    const data = (await res.json()) as IbgeCity[];
    if (target === "create") setCities(data);
    if (target === "edit") setEditCities(data);
  }

  function onChangeCreateState(code: string) {
    setStateIbgeCode(code);
    const found = ibgeStates.find((s) => String(s.id) === code);
    setStateUf(found?.sigla ?? "");
    setStateName(found?.nome ?? "");
    setCityIbgeCode("");
    setCityName("");
  }

  function onChangeEditState(code: string) {
    setEditStateIbgeCode(code);
    const found = ibgeStates.find((s) => String(s.id) === code);
    setEditStateUf(found?.sigla ?? "");
    setEditStateName(found?.nome ?? "");
    setEditCityIbgeCode("");
    setEditCityName("");
  }

  function onChangeCreateCity(code: string) {
    setCityIbgeCode(code);
    const found = cities.find((c) => String(c.id) === code);
    setCityName(found?.nome ?? "");
  }

  function onChangeEditCity(code: string) {
    setEditCityIbgeCode(code);
    const found = editCities.find((c) => String(c.id) === code);
    setEditCityName(found?.nome ?? "");
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

  async function loadStudents() {
    const token = requireToken();
    if (!token) return;
    const res = await fetch(`${API}/students`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as StudentLite[];
    setStudents(data.sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function syncParentStudents(token: string, personId: string, studentIds: string[]) {
    const res = await fetch(`${API}/people/${personId}/students`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ student_ids: studentIds }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async function syncPickupStudents(token: string, personId: string, studentIds: string[]) {
    const res = await fetch(`${API}/people/${personId}/pickup-students`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ student_ids: studentIds }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async function syncFinancialStudents(token: string, personId: string, studentIds: string[]) {
    const res = await fetch(`${API}/people/${personId}/financial-students`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ student_ids: studentIds }),
    });
    if (!res.ok) throw new Error(await res.text());
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
          photo_url: photoUrl || null,
          zip_code: zipCode || null,
          street: street || null,
          address_number: addressNumber || null,
          neighborhood: neighborhood || null,
          complement: complement || null,
          state_ibge_code: stateIbgeCode ? Number(stateIbgeCode) : null,
          state_uf: stateUf || null,
          state_name: stateName || null,
          city_ibge_code: cityIbgeCode ? Number(cityIbgeCode) : null,
          city_name: cityName || null,
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

      if (createRoles.includes("parent")) {
        await syncParentStudents(token, created.id, parentStudentIds);
      }
      if (createRoles.includes("pickup_authorized")) {
        await syncPickupStudents(token, created.id, pickupStudentIds);
      }
      if (createRoles.includes("financial_guardian")) {
        await syncFinancialStudents(token, created.id, financialStudentIds);
      }

      setFullName("");
      setEmail("");
      setPhone("");
      setDocument("");
      setPhotoUrl("");
      setZipCode("");
      setStreet("");
      setAddressNumber("");
      setNeighborhood("");
      setComplement("");
      setStateIbgeCode("");
      setStateUf("");
      setStateName("");
      setCityIbgeCode("");
      setCityName("");
      setCities([]);
      setNotes("");
      setCreateRoles(["parent"]);
      setParentStudentIds([]);
      setPickupStudentIds([]);
      setFinancialStudentIds([]);
      setParentStudentSearch("");
      setPickupStudentSearch("");
      setFinancialStudentSearch("");
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
    setEditPhotoUrl(person.photo_url ?? "");
    setEditZipCode(person.zip_code ?? "");
    setEditStreet(person.street ?? "");
    setEditAddressNumber(person.address_number ?? "");
    setEditNeighborhood(person.neighborhood ?? "");
    setEditComplement(person.complement ?? "");
    setEditStateIbgeCode(person.state_ibge_code ? String(person.state_ibge_code) : "");
    setEditStateUf(person.state_uf ?? "");
    setEditStateName(person.state_name ?? "");
    setEditCityIbgeCode(person.city_ibge_code ? String(person.city_ibge_code) : "");
    setEditCityName(person.city_name ?? "");
    setEditParentStudentIds(person.parent_student_ids ?? []);
    setEditPickupStudentIds(person.pickup_student_ids ?? []);
    setEditFinancialStudentIds(person.financial_student_ids ?? []);
    setEditParentStudentSearch("");
    setEditPickupStudentSearch("");
    setEditFinancialStudentSearch("");
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
    setEditParentStudentSearch("");
    setEditPickupStudentSearch("");
    setEditFinancialStudentSearch("");
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
          photo_url: editPhotoUrl || null,
          zip_code: editZipCode || null,
          street: editStreet || null,
          address_number: editAddressNumber || null,
          neighborhood: editNeighborhood || null,
          complement: editComplement || null,
          state_ibge_code: editStateIbgeCode ? Number(editStateIbgeCode) : null,
          state_uf: editStateUf || null,
          state_name: editStateName || null,
          city_ibge_code: editCityIbgeCode ? Number(editCityIbgeCode) : null,
          city_name: editCityName || null,
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

      if (editRoles.includes("parent")) {
        await syncParentStudents(token, personId, editParentStudentIds);
      } else if (editOriginalRoles.includes("parent")) {
        await syncParentStudents(token, personId, []);
      }
      if (editRoles.includes("pickup_authorized")) {
        await syncPickupStudents(token, personId, editPickupStudentIds);
      } else if (editOriginalRoles.includes("pickup_authorized")) {
        await syncPickupStudents(token, personId, []);
      }
      if (editRoles.includes("financial_guardian")) {
        await syncFinancialStudents(token, personId, editFinancialStudentIds);
      } else if (editOriginalRoles.includes("financial_guardian")) {
        await syncFinancialStudents(token, personId, []);
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

  useEffect(() => {
    void loadIbgeStates();
    void loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stateUf) {
      setCities([]);
      return;
    }
    void loadCitiesByUf(stateUf, "create");
  }, [stateUf]);

  useEffect(() => {
    if (!editStateUf) {
      setEditCities([]);
      return;
    }
    void loadCitiesByUf(editStateUf, "edit");
  }, [editStateUf]);

  useEffect(() => {
    const zipDigits = zipCode.replace(/\D/g, "");
    if (zipDigits.length !== 8) return;
    const timeout = setTimeout(async () => {
      try {
        const viaCep = await fetchViaCep(zipDigits);
        if (!viaCep || viaCep.erro) return;
        setStreet(viaCep.logradouro ?? "");
        setNeighborhood(viaCep.bairro ?? "");
        if (viaCep.complemento) setComplement(viaCep.complemento);

        const targetUf = viaCep.uf ?? "";
        const targetState = ibgeStates.find((s) => s.sigla === targetUf);
        if (targetState) {
          setStateIbgeCode(String(targetState.id));
          setStateUf(targetState.sigla);
          setStateName(targetState.nome);
        }

        const cityCode = (viaCep.ibge ?? "").trim();
        if (cityCode) {
          setCityIbgeCode(cityCode);
          if (viaCep.localidade) setCityName(viaCep.localidade);
        }
      } catch {
        // noop
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [zipCode, ibgeStates]);

  useEffect(() => {
    const zipDigits = editZipCode.replace(/\D/g, "");
    if (zipDigits.length !== 8) return;
    const timeout = setTimeout(async () => {
      try {
        const viaCep = await fetchViaCep(zipDigits);
        if (!viaCep || viaCep.erro) return;
        setEditStreet(viaCep.logradouro ?? "");
        setEditNeighborhood(viaCep.bairro ?? "");
        if (viaCep.complemento) setEditComplement(viaCep.complemento);

        const targetUf = viaCep.uf ?? "";
        const targetState = ibgeStates.find((s) => s.sigla === targetUf);
        if (targetState) {
          setEditStateIbgeCode(String(targetState.id));
          setEditStateUf(targetState.sigla);
          setEditStateName(targetState.nome);
        }

        const cityCode = (viaCep.ibge ?? "").trim();
        if (cityCode) {
          setEditCityIbgeCode(cityCode);
          if (viaCep.localidade) setEditCityName(viaCep.localidade);
        }
      } catch {
        // noop
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [editZipCode, ibgeStates]);

  function toggleCreateRole(roleCode: string) {
    setCreateRoles((prev) => {
      if (prev.includes(roleCode)) return prev.filter((r) => r !== roleCode);
      if (roleCode === "student") return ["student"];
      if (prev.includes("student")) {
        const withoutStudent = prev.filter((r) => r !== "student");
        if (roleCode === "teacher") return [...withoutStudent.filter((r) => r !== "staff"), "teacher"];
        if (roleCode === "staff") return [...withoutStudent.filter((r) => r !== "teacher"), "staff"];
        return [...withoutStudent, roleCode];
      }
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
  const hasParentRole = createRoles.includes("parent");
  const hasPickupAuthorizedRole = createRoles.includes("pickup_authorized");
  const hasFinancialGuardianRole = createRoles.includes("financial_guardian");
  const hasGuardianRole = createRoles.includes("guardian");
  const hasTeacherOrStaffRole = createRoles.includes("teacher") || createRoles.includes("staff");
  const hasSupplierRole = createRoles.includes("supplier");

  const counters = useMemo(() => {
    const initial: Record<string, number> = {
      student: 0,
      parent: 0,
      financial_guardian: 0,
      pickup_authorized: 0,
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

  const filteredStudentsForParentLink = useMemo(() => {
    const q = parentStudentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(q) ||
        student.registration.toLowerCase().includes(q),
    );
  }, [students, parentStudentSearch]);

  const filteredStudentsForEditParentLink = useMemo(() => {
    const q = editParentStudentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(q) ||
        student.registration.toLowerCase().includes(q),
    );
  }, [students, editParentStudentSearch]);

  const filteredStudentsForPickupLink = useMemo(() => {
    const q = pickupStudentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(q) ||
        student.registration.toLowerCase().includes(q),
    );
  }, [students, pickupStudentSearch]);

  const filteredStudentsForEditPickupLink = useMemo(() => {
    const q = editPickupStudentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(q) ||
        student.registration.toLowerCase().includes(q),
    );
  }, [students, editPickupStudentSearch]);

  const filteredStudentsForFinancialLink = useMemo(() => {
    const q = financialStudentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(q) ||
        student.registration.toLowerCase().includes(q),
    );
  }, [students, financialStudentSearch]);

  const filteredStudentsForEditFinancialLink = useMemo(() => {
    const q = editFinancialStudentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(q) ||
        student.registration.toLowerCase().includes(q),
    );
  }, [students, editFinancialStudentSearch]);

  useEffect(() => {
    if (!hasStudentRole || extraStudentRegistration.trim().length > 0) return;
    void suggestStudentRegistration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStudentRole]);

  useEffect(() => {
    if (!hasParentRole) return;
    void loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasParentRole]);

  useEffect(() => {
    if (hasParentRole) return;
    setParentStudentIds([]);
    setParentStudentSearch("");
  }, [hasParentRole]);

  useEffect(() => {
    if (hasPickupAuthorizedRole) return;
    setPickupStudentIds([]);
    setPickupStudentSearch("");
  }, [hasPickupAuthorizedRole]);

  useEffect(() => {
    if (hasFinancialGuardianRole) return;
    setFinancialStudentIds([]);
    setFinancialStudentSearch("");
  }, [hasFinancialGuardianRole]);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cadastros Unificados</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Busca geral de alunos, pais, responsável financeiro, autorizado para buscar aluno, responsáveis vinculados, professores, funcionários e fornecedores.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadPeople} className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow hover:bg-black">
              Atualizar
            </button>
          </div>
        </div>

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-8">
          <Counter title="Alunos" value={counters.student ?? 0} />
          <Counter title="Pais/Mães" value={counters.parent ?? 0} />
          <Counter title="Resp. Financeiro" value={counters.financial_guardian ?? 0} />
          <Counter title="Aut. Busca" value={counters.pickup_authorized ?? 0} />
          <Counter title="Resp. Vinculado" value={counters.guardian ?? 0} />
          <Counter title="Professores" value={counters.teacher ?? 0} />
          <Counter title="Funcionários" value={counters.staff ?? 0} />
          <Counter title="Fornecedores" value={counters.supplier ?? 0} />
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow">
            <h2 className="text-base font-semibold">Filtros</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
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
                className="h-11 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white md:self-end"
              >
                Pesquisar
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow">
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
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-neutral-700">Foto</label>
                <div className="mt-1 flex items-center gap-3">
                  {photoUrl ? (
                    <Image src={photoUrl} alt="Foto do cadastro" width={56} height={56} unoptimized className="h-14 w-14 rounded-full object-cover border border-neutral-300" />
                  ) : (
                    <div className="h-14 w-14 rounded-full border border-dashed border-neutral-300 bg-neutral-50" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const dataUrl = await fileToDataUrl(file);
                      setPhotoUrl(dataUrl);
                    }}
                    className="text-xs"
                  />
                  {photoUrl && (
                    <button
                      type="button"
                      className="h-9 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                      onClick={() => setPhotoUrl("")}
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
              {hasParentRole && (
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-neutral-700">Alunos vinculados ao Pai/Mãe</label>
                  <input
                    value={parentStudentSearch}
                    onChange={(e) => setParentStudentSearch(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                    placeholder="Buscar aluno por nome ou matrícula"
                  />
                  <select
                    multiple
                    value={parentStudentIds}
                    onChange={(e) =>
                      setParentStudentIds(
                        Array.from(e.target.selectedOptions).map((option) => option.value),
                      )
                    }
                    className="mt-2 min-h-24 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  >
                    {filteredStudentsForParentLink.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.registration})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-neutral-600">
                    Selecione um ou mais alunos que este pai/mãe acompanha.
                  </p>
                </div>
              )}
              {hasPickupAuthorizedRole && (
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-neutral-700">Alunos autorizados para busca</label>
                  <input
                    value={pickupStudentSearch}
                    onChange={(e) => setPickupStudentSearch(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                    placeholder="Buscar aluno por nome ou matrícula"
                  />
                  <select
                    multiple
                    value={pickupStudentIds}
                    onChange={(e) =>
                      setPickupStudentIds(
                        Array.from(e.target.selectedOptions).map((option) => option.value),
                      )
                    }
                    className="mt-2 min-h-24 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  >
                    {filteredStudentsForPickupLink.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.registration})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-neutral-600">
                    Selecione os alunos que esta pessoa está autorizada a buscar na escola.
                  </p>
                </div>
              )}
              {hasFinancialGuardianRole && (
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-neutral-700">Alunos vinculados ao Responsável Financeiro</label>
                  <input
                    value={financialStudentSearch}
                    onChange={(e) => setFinancialStudentSearch(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                    placeholder="Buscar aluno por nome ou matrícula"
                  />
                  <select
                    multiple
                    value={financialStudentIds}
                    onChange={(e) =>
                      setFinancialStudentIds(
                        Array.from(e.target.selectedOptions).map((option) => option.value),
                      )
                    }
                    className="mt-2 min-h-24 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  >
                    {filteredStudentsForFinancialLink.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.registration})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-neutral-600">
                    Selecione os alunos pelos quais esta pessoa é responsável financeiramente.
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-neutral-700">CEP</label>
                <input
                  value={zipCode}
                  onChange={(e) => setZipCode(formatCep(e.target.value))}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  placeholder="00000-000"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Estado (IBGE)</label>
                <select
                  value={stateIbgeCode}
                  onChange={(e) => onChangeCreateState(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                >
                  <option value="">Selecione o estado</option>
                  {ibgeStates.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.nome} ({state.sigla})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Cidade (IBGE)</label>
                <select
                  value={cityIbgeCode}
                  onChange={(e) => onChangeCreateCity(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  disabled={!stateUf}
                >
                  <option value="">Selecione a cidade</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Bairro</label>
                <input
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-neutral-700">Rua/Logradouro</label>
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Número</label>
                <input
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Complemento</label>
                <input
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
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
                roles.includes("pickup_authorized") ||
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
                        <div>Foto: {person.photo_url ? "Sim" : "Não"}</div>
                        <div>E-mail: {person.email || "-"}</div>
                        <div>Telefone: {person.phone || "-"}</div>
                        <div>Documento: {person.document || "-"}</div>
                        <div>CEP: {person.zip_code || "-"}</div>
                        <div>UF: {person.state_uf || "-"}</div>
                        <div>Cidade: {person.city_name || "-"}</div>
                        <div>Bairro: {person.neighborhood || "-"}</div>
                        <div>Rua: {person.street || "-"}</div>
                        <div>Número: {person.address_number || "-"}</div>
                        <div>Complemento: {person.complement || "-"}</div>
                        <div>
                          Alunos (pai/mãe): {(person.parent_student_ids ?? [])
                            .map((id) => students.find((s) => s.id === id)?.name)
                            .filter((name): name is string => Boolean(name))
                            .join(", ") || "-"}
                        </div>
                        <div>
                          Alunos (autorizado busca): {(person.pickup_student_ids ?? [])
                            .map((id) => students.find((s) => s.id === id)?.name)
                            .filter((name): name is string => Boolean(name))
                            .join(", ") || "-"}
                        </div>
                        <div>
                          Alunos (responsável financeiro): {(person.financial_student_ids ?? [])
                            .map((id) => students.find((s) => s.id === id)?.name)
                            .filter((name): name is string => Boolean(name))
                            .join(", ") || "-"}
                        </div>
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
                      <div className="md:col-span-2 flex items-center gap-3">
                        {editPhotoUrl ? (
                          <Image src={editPhotoUrl} alt="Foto do cadastro" width={56} height={56} unoptimized className="h-14 w-14 rounded-full object-cover border border-neutral-300" />
                        ) : (
                          <div className="h-14 w-14 rounded-full border border-dashed border-neutral-300 bg-neutral-50" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const dataUrl = await fileToDataUrl(file);
                            setEditPhotoUrl(dataUrl);
                          }}
                          className="text-xs"
                        />
                        {editPhotoUrl && (
                          <button
                            type="button"
                            className="h-9 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                            onClick={() => setEditPhotoUrl("")}
                          >
                            Remover foto
                          </button>
                        )}
                      </div>
                      <input value={editZipCode} onChange={(e) => setEditZipCode(formatCep(e.target.value))} className="h-10 rounded-lg border border-neutral-300 px-3 text-sm" placeholder="CEP" />
                      <select
                        value={editStateIbgeCode}
                        onChange={(e) => onChangeEditState(e.target.value)}
                        className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
                      >
                        <option value="">Estado (IBGE)</option>
                        {ibgeStates.map((state) => (
                          <option key={state.id} value={state.id}>
                            {state.nome} ({state.sigla})
                          </option>
                        ))}
                      </select>
                      <select
                        value={editCityIbgeCode}
                        onChange={(e) => onChangeEditCity(e.target.value)}
                        className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
                        disabled={!editStateUf}
                      >
                        <option value="">Cidade (IBGE)</option>
                        {editCities.map((city) => (
                          <option key={city.id} value={city.id}>
                            {city.nome}
                          </option>
                        ))}
                      </select>
                      <input value={editNeighborhood} onChange={(e) => setEditNeighborhood(e.target.value)} className="h-10 rounded-lg border border-neutral-300 px-3 text-sm" placeholder="Bairro" />
                      <input value={editStreet} onChange={(e) => setEditStreet(e.target.value)} className="h-10 rounded-lg border border-neutral-300 px-3 text-sm md:col-span-2" placeholder="Rua/Logradouro" />
                      <input value={editAddressNumber} onChange={(e) => setEditAddressNumber(e.target.value)} className="h-10 rounded-lg border border-neutral-300 px-3 text-sm" placeholder="Número" />
                      <input value={editComplement} onChange={(e) => setEditComplement(e.target.value)} className="h-10 rounded-lg border border-neutral-300 px-3 text-sm" placeholder="Complemento" />
                      {editRoles.includes("parent") && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-neutral-700">Alunos vinculados ao Pai/Mãe</label>
                          <input
                            value={editParentStudentSearch}
                            onChange={(e) => setEditParentStudentSearch(e.target.value)}
                            className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                            placeholder="Buscar aluno por nome ou matrícula"
                          />
                          <select
                            multiple
                            value={editParentStudentIds}
                            onChange={(e) =>
                              setEditParentStudentIds(
                                Array.from(e.target.selectedOptions).map((option) => option.value),
                              )
                            }
                            className="mt-2 min-h-24 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                          >
                            {filteredStudentsForEditParentLink.map((student) => (
                              <option key={student.id} value={student.id}>
                                {student.name} ({student.registration})
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-neutral-600">
                            Você pode salvar sem vínculos e associar alunos depois.
                          </p>
                        </div>
                      )}
                      {editRoles.includes("pickup_authorized") && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-neutral-700">Alunos autorizados para busca</label>
                          <input
                            value={editPickupStudentSearch}
                            onChange={(e) => setEditPickupStudentSearch(e.target.value)}
                            className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                            placeholder="Buscar aluno por nome ou matrícula"
                          />
                          <select
                            multiple
                            value={editPickupStudentIds}
                            onChange={(e) =>
                              setEditPickupStudentIds(
                                Array.from(e.target.selectedOptions).map((option) => option.value),
                              )
                            }
                            className="mt-2 min-h-24 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                          >
                            {filteredStudentsForEditPickupLink.map((student) => (
                              <option key={student.id} value={student.id}>
                                {student.name} ({student.registration})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {editRoles.includes("financial_guardian") && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-neutral-700">Alunos vinculados ao Responsável Financeiro</label>
                          <input
                            value={editFinancialStudentSearch}
                            onChange={(e) => setEditFinancialStudentSearch(e.target.value)}
                            className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                            placeholder="Buscar aluno por nome ou matrícula"
                          />
                          <select
                            multiple
                            value={editFinancialStudentIds}
                            onChange={(e) =>
                              setEditFinancialStudentIds(
                                Array.from(e.target.selectedOptions).map((option) => option.value),
                              )
                            }
                            className="mt-2 min-h-24 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                          >
                            {filteredStudentsForEditFinancialLink.map((student) => (
                              <option key={student.id} value={student.id}>
                                {student.name} ({student.registration})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
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

async function fetchViaCep(zipDigits: string): Promise<ViaCepResponse | null> {
  if (zipDigits.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${zipDigits}/json/`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as ViaCepResponse;
}

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo de imagem"));
    reader.readAsDataURL(file);
  });
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
