"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Student = {
  id: string;
  name: string;
  registration: string;
};

type Person = {
  id: string;
  full_name: string;
  email: string | null;
  role_codes?: string[];
  is_active?: boolean;
};

type Installment = {
  id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: string;
  boleto_code: string | null;
  boleto_url: string | null;
  pix_copy_paste: string | null;
  payment_instructions: string | null;
  emailed_at: string | null;
  paid_at: string | null;
};

type Contract = {
  id: string;
  student_id: string;
  student_name: string;
  school_name: string;
  school_code: string;
  school_city: string | null;
  school_signature_name: string | null;
  payer_person_id: string | null;
  recipient_person_ids: string[];
  description: string;
  total_amount: number;
  installments_count: number;
  first_due_date: string;
  billing_mode: "provider_boleto" | "school_booklet" | "school_booklet_pix";
  school_pix_key: string | null;
  school_payment_instructions: string | null;
  status: string;
  installments: Installment[];
};

type ContractTemplateSettings = {
  school_name: string;
  school_code: string;
  school_city: string | null;
  school_signature_name: string | null;
  template: string;
};

type SchoolSettingsLite = {
  school_name: string;
  school_code: string;
};

type FinancialAccount = {
  id: string;
  name: string;
  account_type: "current" | "cash";
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
};

type FinancialCategory = {
  id: string;
  name: string;
  flow: "payable" | "receivable" | "both";
  is_active: boolean;
};

type Payable = {
  id: string;
  description: string;
  vendor_person_id: string | null;
  vendor_counterparty_id: string | null;
  vendor_name: string | null;
  category_id: string | null;
  category: string | null;
  due_date: string;
  amount: number;
  status: "pending" | "paid" | "cancelled";
  account_id: string | null;
  paid_at: string | null;
};

type Receivable = {
  id: string;
  description: string;
  payer_person_id: string | null;
  payer_counterparty_id: string | null;
  payer_name: string | null;
  category_id: string | null;
  category: string | null;
  due_date: string;
  amount: number;
  status: "pending" | "received" | "cancelled";
  source_type: "manual" | "installment";
  contract_id: string | null;
  installment_id: string | null;
  student_id: string | null;
  account_id: string | null;
  received_at: string | null;
};

type Transfer = {
  id: string;
  from_account_id: string;
  to_account_id: string;
  transfer_date: string;
  amount: number;
  note: string | null;
};

type FinancialGuardianStatementItem = {
  receivable_id: string;
  description: string;
  student_id: string | null;
  student_name: string | null;
  due_date: string;
  amount: number;
  status: string;
  received_at: string | null;
};

type FinancialGuardianStatement = {
  person_id: string;
  person_name: string;
  person_email: string | null;
  person_phone: string | null;
  person_document: string | null;
  person_street: string | null;
  person_address_number: string | null;
  person_neighborhood: string | null;
  person_city_name: string | null;
  person_state_uf: string | null;
  school_name: string;
  school_code: string;
  school_city: string | null;
  school_signature_name: string | null;
  total_paid: number;
  total_open: number;
  pending_balance_total: number;
  items: FinancialGuardianStatementItem[];
};

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function FinancialPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [financialPeople, setFinancialPeople] = useState<Person[]>([]);
  const [peopleCatalog, setPeopleCatalog] = useState<Person[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [payablesSearch, setPayablesSearch] = useState("");
  const [receivablesSearch, setReceivablesSearch] = useState("");
  const [statementPayerPersonId, setStatementPayerPersonId] = useState("");
  const [statementPeriodMode, setStatementPeriodMode] = useState<"current_year" | "custom">("current_year");
  const [statementDateFrom, setStatementDateFrom] = useState("");
  const [statementDateTo, setStatementDateTo] = useState("");
  const [statement, setStatement] = useState<FinancialGuardianStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<"contracts" | "accounts" | "transfers" | "catalogs">("contracts");
  const [accountsSection, setAccountsSection] = useState<"current" | "cash" | "payables" | "receivables">("current");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [studentId, setStudentId] = useState("");
  const [description, setDescription] = useState("Mensalidade escolar");
  const [totalAmount, setTotalAmount] = useState("");
  const [installmentsCount, setInstallmentsCount] = useState("12");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [billingMode, setBillingMode] = useState<"provider_boleto" | "school_booklet" | "school_booklet_pix">("school_booklet");
  const [schoolPixKey, setSchoolPixKey] = useState("");
  const [schoolPaymentInstructions, setSchoolPaymentInstructions] = useState("");
  const [payerPersonId, setPayerPersonId] = useState("");
  const [recipientPersonIds, setRecipientPersonIds] = useState<string[]>([]);
  const [newCurrentAccountName, setNewCurrentAccountName] = useState("");
  const [newCurrentAccountInitialBalance, setNewCurrentAccountInitialBalance] = useState("");
  const [newCashAccountName, setNewCashAccountName] = useState("");
  const [newCashAccountInitialBalance, setNewCashAccountInitialBalance] = useState("");
  const [payableDescription, setPayableDescription] = useState("");
  const [payableVendorPersonId, setPayableVendorPersonId] = useState("");
  const [payableCategoryId, setPayableCategoryId] = useState("");
  const [payableDueDate, setPayableDueDate] = useState("");
  const [payableAmount, setPayableAmount] = useState("");
  const [receivableDescription, setReceivableDescription] = useState("");
  const [receivablePayerPersonId, setReceivablePayerPersonId] = useState("");
  const [receivableCategoryId, setReceivableCategoryId] = useState("");
  const [receivableDueDate, setReceivableDueDate] = useState("");
  const [receivableAmount, setReceivableAmount] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryFlow, setNewCategoryFlow] = useState<"payable" | "receivable" | "both">("both");
  const [payableAccountById, setPayableAccountById] = useState<Record<string, string>>({});
  const [receivableAccountById, setReceivableAccountById] = useState<Record<string, string>>({});
  const [transferFromAccountId, setTransferFromAccountId] = useState("");
  const [transferToAccountId, setTransferToAccountId] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolCity, setSchoolCity] = useState("");
  const [schoolSignatureName, setSchoolSignatureName] = useState("");
  const [contractTemplate, setContractTemplate] = useState("");
  const contractEditorRef = useRef<HTMLDivElement | null>(null);

  function openBookletPreview(contract: Contract, installment: Installment) {
    const previewWindow = window.open("", "_blank", "width=900,height=700");
    if (!previewWindow) return;
    const qrPayload = installment.pix_copy_paste ?? installment.boleto_code ?? "";
    const qrImageUrl = qrPayload
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayload)}`
      : "";
    const pixSection = installment.pix_copy_paste
      ? `<div class="pix-copy"><div class="label">PIX Copia e Cola</div><code id="pix-code">${escapeHtml(installment.pix_copy_paste)}</code></div>`
      : "";
    const qrSection = qrImageUrl
      ? `<div class="qr-wrap"><img src="${qrImageUrl}" width="210" height="210" alt="QR Code da cobranca" /></div>`
      : "";
    const instructions = installment.payment_instructions
      ? `<div class="instr"><span class="label">Instrucoes</span><span>${escapeHtml(installment.payment_instructions)}</span></div>`
      : "";
    const copyPixButton = installment.pix_copy_paste
      ? `<button onclick="copyPix()">Copiar PIX</button>`
      : "";
    const schoolDisplayName = schoolName || contract.school_name || "Escola";
    const schoolDisplayCode = schoolCode || contract.school_code || "-";
    const schoolDisplayCity = schoolCity || contract.school_city || "-";
    const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Carne ${escapeHtml(installment.boleto_code ?? "")}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: "Segoe UI", Tahoma, sans-serif; background: #eef2f7; color: #111827; }
      .page { max-width: 920px; margin: 24px auto; padding: 0 16px; }
      .sheet { background: #fff; border: 1px solid #dbe3ef; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
      .head { padding: 20px 24px; background: linear-gradient(135deg, #0b3b77, #165fb8); color: #fff; }
      .head h1 { margin: 0; font-size: 24px; letter-spacing: 0.2px; }
      .head p { margin: 6px 0 0; opacity: 0.92; font-size: 13px; }
      .body { padding: 20px 24px 24px; }
      .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; margin-bottom: 16px; }
      .item { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; background: #f9fafb; }
      .label { display: block; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
      .value { font-size: 14px; font-weight: 600; color: #111827; }
      .highlight { border: 1px solid #cce2ff; background: #edf5ff; border-radius: 12px; padding: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; gap: 12px; }
      .highlight .amount { font-size: 26px; font-weight: 800; color: #0b3b77; }
      .grid { display: grid; grid-template-columns: 1fr 250px; gap: 16px; align-items: start; }
      .instr { border-left: 3px solid #0b3b77; background: #f8fafc; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; display: grid; gap: 4px; }
      .pix-copy code { display: block; margin-top: 4px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; font-size: 11px; word-break: break-all; }
      .qr-wrap { border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; text-align: center; padding: 10px; }
      .qr-wrap img { display: block; margin: 0 auto; }
      .actions { padding: 0 24px 20px; display: flex; gap: 8px; }
      button { height: 38px; border-radius: 8px; border: 1px solid #9ca3af; background: #fff; padding: 0 12px; cursor: pointer; font-weight: 600; }
      button:hover { background: #f3f4f6; }
      @media (max-width: 760px) { .meta { grid-template-columns: 1fr; } .grid { grid-template-columns: 1fr; } }
      @media print {
        body { background: #fff; }
        .page { margin: 0; max-width: none; padding: 0; }
        .sheet { border: none; border-radius: 0; box-shadow: none; }
        .actions { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="sheet">
        <div class="head">
          <h1>Carnê Escolar</h1>
          <p>${escapeHtml(schoolDisplayName)} (${escapeHtml(schoolDisplayCode)}) • ${escapeHtml(schoolDisplayCity)}</p>
        </div>
        <div class="body">
          <div class="highlight">
            <div>
              <span class="label">Codigo da parcela</span>
              <span class="value">${escapeHtml(installment.boleto_code ?? "-")}</span>
            </div>
            <div style="text-align:right">
              <span class="label">Valor</span>
              <span class="amount">R$ ${installment.amount.toFixed(2)}</span>
            </div>
          </div>
          <div class="meta">
            <div class="item"><span class="label">Aluno</span><span class="value">${escapeHtml(contract.student_name)}</span></div>
            <div class="item"><span class="label">Parcela</span><span class="value">${installment.installment_number}</span></div>
            <div class="item"><span class="label">Descricao</span><span class="value">${escapeHtml(contract.description)}</span></div>
            <div class="item"><span class="label">Vencimento</span><span class="value">${escapeHtml(installment.due_date)}</span></div>
          </div>
          <div class="grid">
            <div>
              ${instructions}
              ${pixSection}
            </div>
            <div>${qrSection}</div>
          </div>
        </div>
        <div class="actions">
        ${copyPixButton}
        <button onclick="window.print()">Imprimir</button>
        </div>
      </div>
    </div>
    <script>
      function copyPix() {
        var el = document.getElementById("pix-code");
        var value = el ? (el.textContent || "") : "";
        if (!value) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(function () {
            alert("PIX copiado");
          }).catch(function () {
            fallbackCopy(value);
          });
          return;
        }
        fallbackCopy(value);
      }
      function fallbackCopy(value) {
        var ta = document.createElement("textarea");
        ta.value = value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        alert("PIX copiado");
      }
    </script>
  </body>
</html>`;
    previewWindow.document.open();
    previewWindow.document.write(html);
    previewWindow.document.close();
  }

  function openContractPreview(contract: Contract) {
    const payerName =
      (contract.payer_person_id ? financialPeopleById.get(contract.payer_person_id)?.full_name : "") ||
      "____________________________________";
    const today = new Date().toISOString().slice(0, 10);
    const schoolDisplayName = schoolName || contract.school_name || "Escola";
    const schoolDisplayCode = schoolCode || contract.school_code || "-";
    const schoolDisplayCity = schoolCity || contract.school_city || "Cidade";
    const schoolSigner = schoolSignatureName || contract.school_signature_name || "Representante da Escola";
    const templateRaw = contractTemplate.trim().length > 0 ? contractTemplate : normalizeTemplateHtml(defaultContractTemplate());
    const filled = applyTemplate(templateRaw, {
      school_name: schoolDisplayName,
      school_code: schoolDisplayCode,
      school_city: schoolDisplayCity,
      school_signature_name: schoolSigner,
      date: today,
      student_name: contract.student_name,
      payer_name: payerName,
      description: contract.description,
      total_amount: contract.total_amount.toFixed(2),
      installments_count: String(contract.installments_count),
      first_due_date: contract.first_due_date,
    });
    const previewWindow = window.open("", "_blank", "width=1000,height=760");
    if (!previewWindow) return;
    const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Contrato - ${escapeHtml(contract.student_name)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #eef2f7; color: #111827; font-family: "Segoe UI", Tahoma, sans-serif; }
      .doc { width: 210mm; margin: 18px auto; }
      .paper {
        width: 210mm;
        min-height: 297mm;
        background: #fff;
        border: 1px solid #dbe3ef;
        border-radius: 10px;
        box-shadow: 0 10px 28px rgba(2, 6, 23, 0.08);
        margin-bottom: 12px;
        padding: 14mm 14mm 12mm;
        display: flex;
        flex-direction: column;
      }
      .paper-head { border-bottom: 1px solid #d1d5db; padding-bottom: 8px; margin-bottom: 10px; }
      .title { font-size: 18px; font-weight: 800; margin: 0 0 4px; }
      .subtitle { font-size: 12px; color: #4b5563; margin: 0; }
      .paper-body {
        height: 225mm;
        overflow: hidden;
        font-size: 14px;
        line-height: 1.65;
      }
      .paper-body p { margin: 0 0 10px; }
      .paper-foot {
        margin-top: auto;
        border-top: 1px solid #d1d5db;
        padding-top: 8px;
        font-size: 11px;
        color: #4b5563;
        text-align: right;
      }
      .actions { display: flex; gap: 8px; margin: 12px 0 20px; }
      button { height: 38px; border-radius: 8px; border: 1px solid #9ca3af; background: #fff; padding: 0 12px; cursor: pointer; font-weight: 600; }
      button:hover { background: #f3f4f6; }
      #source-content { display: none; }
      @page { size: A4; margin: 10mm; }
      @media print {
        body { background: #fff; }
        .doc { width: auto; margin: 0; }
        .paper { border: none; box-shadow: none; border-radius: 0; margin: 0; page-break-after: always; min-height: auto; }
        .paper:last-of-type { page-break-after: auto; }
        .actions { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="doc">
      <div id="pages"></div>
      <div class="actions"><button onclick="window.print()">Imprimir contrato</button></div>
      <div id="source-content">${sanitizeContractHtml(filled)}</div>
    </div>
    <script>
      (function () {
        const pagesRoot = document.getElementById("pages");
        const source = document.getElementById("source-content");
        if (!pagesRoot || !source) return;

        const blocks = Array.from(source.childNodes).map((node) => node.cloneNode(true));

        function makePage() {
          const page = document.createElement("section");
          page.className = "paper";
          page.innerHTML = '<div class="paper-head"><h1 class="title">Contrato de Prestação de Serviços Educacionais</h1><p class="subtitle">${escapeHtml(schoolDisplayName)} (${escapeHtml(schoolDisplayCode)}) - ${escapeHtml(schoolDisplayCity)}</p></div><div class="paper-body"></div><div class="paper-foot">Página <span class="page-current"></span> de <span class="page-total"></span></div>';
          pagesRoot.appendChild(page);
          return page.querySelector(".paper-body");
        }

        let currentBody = makePage();
        if (!currentBody) return;

        blocks.forEach((node) => {
          currentBody.appendChild(node);
          if (currentBody.scrollHeight > currentBody.clientHeight) {
            currentBody.removeChild(node);
            currentBody = makePage();
            if (!currentBody) return;
            currentBody.appendChild(node);
          }
        });

        const pages = Array.from(document.querySelectorAll(".paper"));
        const total = pages.length;
        pages.forEach((page, idx) => {
          const cur = page.querySelector(".page-current");
          const all = page.querySelector(".page-total");
          if (cur) cur.textContent = String(idx + 1);
          if (all) all.textContent = String(total);
        });
      })();
    </script>
  </body>
</html>`;
    previewWindow.document.open();
    previewWindow.document.write(html);
    previewWindow.document.close();
  }

  function formatContract(command: string, value?: string) {
    if (!contractEditorRef.current) return;
    contractEditorRef.current.focus();
    document.execCommand(command, false, value);
    setContractTemplate(contractEditorRef.current.innerHTML);
  }

  function requireToken() {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      router.replace("/login");
      return null;
    }
    return token;
  }

  async function loadAll() {
    const token = requireToken();
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const [studentsRes, peopleRes, peopleCatalogRes, contractsRes, templateRes, schoolRes, accountsRes, categoriesRes, payablesRes, receivablesRes, transfersRes] = await Promise.all([
        fetch(`${API}/students`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/people?person_type=financial_guardian&is_active=true`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/people?is_active=true`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/financial/contracts`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/financial/contract-template`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/school/settings`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/financial/accounts`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/financial/categories`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/financial/payables`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/financial/receivables`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/financial/transfers`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);
      if (!studentsRes.ok) throw new Error(await studentsRes.text());
      if (!peopleRes.ok) throw new Error(await peopleRes.text());
      if (!contractsRes.ok) throw new Error(await contractsRes.text());
      if (!templateRes.ok) throw new Error(await templateRes.text());
      if (!accountsRes.ok) throw new Error(await accountsRes.text());
      if (!peopleCatalogRes.ok) throw new Error(await peopleCatalogRes.text());
      if (!categoriesRes.ok) throw new Error(await categoriesRes.text());
      if (!payablesRes.ok) throw new Error(await payablesRes.text());
      if (!receivablesRes.ok) throw new Error(await receivablesRes.text());
      if (!transfersRes.ok) throw new Error(await transfersRes.text());

      setStudents((await studentsRes.json()) as Student[]);
      setFinancialPeople((await peopleRes.json()) as Person[]);
      setPeopleCatalog((await peopleCatalogRes.json()) as Person[]);
      setContracts((await contractsRes.json()) as Contract[]);
      setAccounts((await accountsRes.json()) as FinancialAccount[]);
      setCategories((await categoriesRes.json()) as FinancialCategory[]);
      setPayables((await payablesRes.json()) as Payable[]);
      setReceivables((await receivablesRes.json()) as Receivable[]);
      setTransfers((await transfersRes.json()) as Transfer[]);
      const templateData = (await templateRes.json()) as ContractTemplateSettings;
      let schoolData: SchoolSettingsLite | null = null;
      if (schoolRes.ok) {
        schoolData = (await schoolRes.json()) as SchoolSettingsLite;
      }
      const localSchoolName = localStorage.getItem("school_name")?.trim() ?? "";
      const localSchoolCode = localStorage.getItem("school_code")?.trim() ?? "";
      const resolvedSchoolName =
        schoolData?.school_name?.trim() ||
        templateData.school_name?.trim() ||
        localSchoolName ||
        "Escola";
      const resolvedSchoolCode =
        schoolData?.school_code?.trim() ||
        templateData.school_code?.trim() ||
        localSchoolCode;
      setSchoolName(resolvedSchoolName);
      setSchoolCode(resolvedSchoolCode);
      setSchoolCity(templateData.school_city ?? "");
      setSchoolSignatureName(templateData.school_signature_name ?? "");
      const normalizedTemplate =
        (templateData.template ?? "").trim().length > 0
          ? normalizeTemplateHtml(templateData.template)
          : normalizeTemplateHtml(exampleContractTemplate());
      setContractTemplate(normalizedTemplate);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function createContract(e: React.FormEvent) {
    e.preventDefault();
    const token = requireToken();
    if (!token) return;
    if (!studentId || !totalAmount || !firstDueDate) {
      setError("Preencha aluno, valor total e primeiro vencimento.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/financial/contracts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_id: studentId,
          payer_person_id: payerPersonId || null,
          recipient_person_ids: recipientPersonIds,
          description: description.trim(),
          total_amount: Number(totalAmount),
          installments_count: Number(installmentsCount),
          first_due_date: firstDueDate,
          billing_mode: billingMode,
          school_pix_key: schoolPixKey || null,
          school_payment_instructions: schoolPaymentInstructions || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStudentId("");
      setDescription("Mensalidade escolar");
      setTotalAmount("");
      setInstallmentsCount("12");
      setFirstDueDate("");
      setBillingMode("school_booklet");
      setSchoolPixKey("");
      setSchoolPaymentInstructions("");
      setPayerPersonId("");
      setRecipientPersonIds([]);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(
    e: React.FormEvent,
    accountType: "current" | "cash",
    name: string,
    initialBalance: string,
    reset: () => void,
  ) {
    e.preventDefault();
    const token = requireToken();
    if (!token) return;
    if (!name.trim()) {
      setError("Informe o nome da conta.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/financial/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          account_type: accountType,
          initial_balance: initialBalance ? Number(initialBalance) : 0,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      reset();
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    const token = requireToken();
    if (!token) return;
    if (!newCategoryName.trim()) {
      setError("Informe o nome da categoria.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/financial/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          flow: newCategoryFlow,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNewCategoryName("");
      setNewCategoryFlow("both");
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function createPayable(e: React.FormEvent) {
    e.preventDefault();
    const token = requireToken();
    if (!token) return;
    if (!payableDescription.trim() || !payableVendorPersonId || !payableCategoryId || !payableDueDate || !payableAmount) {
      setError("Preencha descrição, beneficiário, categoria, vencimento e valor da conta a pagar.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/financial/payables`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: payableDescription.trim(),
          vendor_person_id: payableVendorPersonId,
          category_id: payableCategoryId,
          due_date: payableDueDate,
          amount: Number(payableAmount),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPayableDescription("");
      setPayableVendorPersonId("");
      setPayableCategoryId("");
      setPayableAmount("");
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function createReceivable(e: React.FormEvent) {
    e.preventDefault();
    const token = requireToken();
    if (!token) return;
    if (!receivableDescription.trim() || !receivablePayerPersonId || !receivableCategoryId || !receivableDueDate || !receivableAmount) {
      setError("Preencha descrição, pagador, categoria, vencimento e valor da conta a receber.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/financial/receivables`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: receivableDescription.trim(),
          payer_person_id: receivablePayerPersonId,
          category_id: receivableCategoryId,
          due_date: receivableDueDate,
          amount: Number(receivableAmount),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setReceivableDescription("");
      setReceivablePayerPersonId("");
      setReceivableCategoryId("");
      setReceivableAmount("");
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function markPayableAsPaid(payableId: string) {
    const token = requireToken();
    if (!token) return;
    const accountId = payableAccountById[payableId];
    if (!accountId) {
      setError("Selecione a conta de saída para quitar a conta a pagar.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/financial/payables/${payableId}/pay`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          account_id: accountId,
          paid_at: null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function markReceivableAsReceived(receivableId: string) {
    const token = requireToken();
    if (!token) return;
    const accountId = receivableAccountById[receivableId];
    if (!accountId) {
      setError("Selecione a conta de entrada para receber o valor.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/financial/receivables/${receivableId}/receive`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          account_id: accountId,
          received_at: null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function loadFinancialGuardianStatement() {
    const token = requireToken();
    if (!token) return;
    if (!statementPayerPersonId) {
      setError("Selecione um responsável financeiro para carregar o extrato.");
      return;
    }
    setStatementLoading(true);
    setError(null);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const url = new URL(`${API}/financial/payers/${statementPayerPersonId}/statement`);
      if (statementPeriodMode === "current_year") {
        url.searchParams.set("date_from", `${year}-01-01`);
        url.searchParams.set("date_to", `${year}-12-31`);
      } else {
        if (!statementDateFrom || !statementDateTo) {
          throw new Error("Informe data inicial e final para o período personalizado.");
        }
        url.searchParams.set("date_from", statementDateFrom);
        url.searchParams.set("date_to", statementDateTo);
      }
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      setStatement((await res.json()) as FinancialGuardianStatement);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setStatementLoading(false);
    }
  }

  function printFinancialGuardianStatement() {
    if (!statement) {
      setError("Carregue o extrato antes de imprimir.");
      return;
    }
    const win = window.open("", "_blank", "width=980,height=760");
    if (!win) return;
    const schoolDisplay = schoolName || "Escola";
    const now = new Date();
    const generatedAt = now.toLocaleString("pt-BR");
    const periodLabel =
      statementPeriodMode === "current_year"
        ? `Ano corrente (${now.getFullYear()})`
        : `Período: ${formatDateBR(statementDateFrom)} a ${formatDateBR(statementDateTo)}`;
    const personAddress = [
      statement.person_street,
      statement.person_address_number,
      statement.person_neighborhood,
      statement.person_city_name,
      statement.person_state_uf,
    ]
      .filter(Boolean)
      .join(", ");
    const rows = statement.items
      .map(
        (it) => `
          <tr>
            <td>${escapeHtml(it.description)}</td>
            <td>${escapeHtml(it.student_name ?? "-")}</td>
            <td>${formatDateBR(it.due_date)}</td>
            <td>R$ ${formatCurrencyBR(it.amount)}</td>
            <td>${escapeHtml(receivableStatusLabel(it.status as Receivable["status"]))}</td>
            <td>${it.received_at ? formatDateBR(it.received_at) : "-"}</td>
          </tr>
        `,
      )
      .join("");
    const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Extrato financeiro - ${escapeHtml(statement.person_name)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #eef2f7; font-family: "Segoe UI", Tahoma, sans-serif; color: #0f172a; }
      .page { max-width: 1020px; margin: 20px auto; padding: 0 16px; }
      .sheet { background: #fff; border: 1px solid #dbe3ef; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 28px rgba(2, 6, 23, 0.08); }
      .head { padding: 18px 24px; background: linear-gradient(135deg, #0b3b77, #165fb8); color: #fff; }
      .head h1 { margin: 0; font-size: 24px; }
      .head p { margin: 4px 0 0; font-size: 13px; opacity: 0.92; }
      .meta { padding: 16px 24px; border-bottom: 1px solid #e5e7eb; display: grid; gap: 8px; }
      .meta .line { font-size: 13px; color: #1f2937; }
      .summary { padding: 0 24px 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .card { border: 1px solid #dbe3ef; border-radius: 10px; background: #f8fafc; padding: 10px 12px; }
      .card .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
      .card .value { font-size: 20px; font-weight: 800; color: #0f172a; }
      .table-wrap { padding: 0 24px 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: left; }
      th { color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
      .foot { padding: 10px 24px 16px; font-size: 11px; color: #64748b; text-align: right; }
      .actions { padding: 0 24px 20px; }
      button { height: 38px; border-radius: 8px; border: 1px solid #9ca3af; background: #fff; padding: 0 12px; font-weight: 600; cursor: pointer; }
      @media print {
        body { background: #fff; }
        .page { margin: 0; max-width: none; padding: 0; }
        .sheet { border: none; border-radius: 0; box-shadow: none; }
        .actions { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="sheet">
        <div class="head">
          <h1>Extrato Financeiro do Responsável</h1>
          <p>${escapeHtml(schoolDisplay)}</p>
        </div>
        <div class="meta">
          <div class="line"><strong>Escola:</strong> ${escapeHtml(statement.school_name)} (${escapeHtml(statement.school_code)})${statement.school_city ? ` - ${escapeHtml(statement.school_city)}` : ""}</div>
          <div class="line"><strong>Responsável:</strong> ${escapeHtml(statement.person_name)}</div>
          <div class="line"><strong>Documento:</strong> ${escapeHtml(statement.person_document ?? "-")} &nbsp; <strong>Telefone:</strong> ${escapeHtml(statement.person_phone ?? "-")} &nbsp; <strong>E-mail:</strong> ${escapeHtml(statement.person_email ?? "-")}</div>
          <div class="line"><strong>Endereço:</strong> ${escapeHtml(personAddress || "-")}</div>
          <div class="line"><strong>Período:</strong> ${escapeHtml(periodLabel)}</div>
          <div class="line"><strong>Gerado em:</strong> ${escapeHtml(generatedAt)}</div>
        </div>
        <div class="summary">
          <div class="card">
            <div class="label">Total pago</div>
            <div class="value">R$ ${formatCurrencyBR(statement.total_paid)}</div>
          </div>
          <div class="card">
            <div class="label">Total em aberto</div>
            <div class="value">R$ ${formatCurrencyBR(statement.total_open)}</div>
          </div>
          <div class="card">
            <div class="label">Saldo pendente total</div>
            <div class="value">R$ ${formatCurrencyBR(statement.pending_balance_total)}</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Aluno</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Recebimento</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="6">Nenhum lançamento encontrado.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="foot">Documento de apoio financeiro para envio ao responsável. ${statement.school_signature_name ? `Responsável na escola: ${escapeHtml(statement.school_signature_name)}.` : ""}</div>
        <div class="actions"><button onclick="window.print()">Imprimir extrato</button></div>
      </div>
    </div>
  </body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  async function createTransfer(e: React.FormEvent) {
    e.preventDefault();
    const token = requireToken();
    if (!token) return;
    if (!transferFromAccountId || !transferToAccountId || !transferDate || !transferAmount) {
      setError("Preencha contas de origem/destino, data e valor da transferência.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/financial/transfers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          from_account_id: transferFromAccountId,
          to_account_id: transferToAccountId,
          transfer_date: transferDate,
          amount: Number(transferAmount),
          note: transferNote || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTransferAmount("");
      setTransferNote("");
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function saveContractTemplate() {
    const token = requireToken();
    if (!token) return;
    if (contractTemplate.trim().length < 40) {
      setError("O contrato padrão precisa ter mais conteúdo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/financial/contract-template`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          template: contractTemplate,
          school_city: schoolCity || null,
          school_signature_name: schoolSignatureName || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const payload = (await res.json()) as ContractTemplateSettings;
      const resolvedSchoolName =
        payload.school_name?.trim() ||
        localStorage.getItem("school_name")?.trim() ||
        "Escola";
      const resolvedSchoolCode =
        payload.school_code?.trim() ||
        localStorage.getItem("school_code")?.trim() ||
        "";
      setSchoolName(resolvedSchoolName);
      setSchoolCode(resolvedSchoolCode);
      setSchoolCity(payload.school_city ?? "");
      setSchoolSignatureName(payload.school_signature_name ?? "");
      setContractTemplate(normalizeTemplateHtml(payload.template));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function generateBoletos(contractId: string) {
    const token = requireToken();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/financial/contracts/${contractId}/generate-boletos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function sendEmails(contractId: string) {
    const token = requireToken();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/financial/contracts/${contractId}/send-boletos-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(contractId: string, installmentId: string) {
    const token = requireToken();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/financial/contracts/${contractId}/installments/${installmentId}/pay`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ paid_at: null }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    const year = today.getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    setFirstDueDate(iso);
    setPayableDueDate(iso);
    setReceivableDueDate(iso);
    setTransferDate(iso);
    setStatementDateFrom(yearStart);
    setStatementDateTo(yearEnd);
  }, []);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!contractEditorRef.current) return;
    if (contractEditorRef.current.innerHTML === contractTemplate) return;
    contractEditorRef.current.innerHTML = contractTemplate;
  }, [contractTemplate]);

  const financialPeopleById = useMemo(() => {
    const m = new Map<string, Person>();
    financialPeople.forEach((p) => m.set(p.id, p));
    return m;
  }, [financialPeople]);

  const payablePeople = useMemo(
    () => peopleCatalog.filter((p) => p.is_active !== false),
    [peopleCatalog],
  );
  const payerPeople = useMemo(
    () =>
      peopleCatalog.filter((p) => {
        const roles = p.role_codes ?? [];
        return roles.includes("financial_guardian") || roles.includes("parent");
      }),
    [peopleCatalog],
  );
  const payableCategories = useMemo(
    () => categories.filter((c) => c.is_active && (c.flow === "payable" || c.flow === "both")),
    [categories],
  );
  const receivableCategories = useMemo(
    () => categories.filter((c) => c.is_active && (c.flow === "receivable" || c.flow === "both")),
    [categories],
  );
  const currentAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "current"),
    [accounts],
  );
  const cashAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "cash"),
    [accounts],
  );
  const payablesFiltered = useMemo(() => {
    const q = payablesSearch.trim().toLowerCase();
    if (!q) return payables;
    return payables.filter((p) =>
      (p.description ?? "").toLowerCase().includes(q) ||
      (p.vendor_name ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q),
    );
  }, [payables, payablesSearch]);
  const receivablesFiltered = useMemo(() => {
    const q = receivablesSearch.trim().toLowerCase();
    if (!q) return receivables;
    return receivables.filter((r) =>
      (r.description ?? "").toLowerCase().includes(q) ||
      (r.payer_name ?? "").toLowerCase().includes(q) ||
      (r.category ?? "").toLowerCase().includes(q),
    );
  }, [receivables, receivablesSearch]);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Contratos de mensalidade, geração de boletos e envio por e-mail para responsáveis financeiros.
            </p>
          </div>
          <button
            onClick={loadAll}
            disabled={loading || busy}
            className="h-10 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 disabled:opacity-60"
          >
            Atualizar
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveSection("contracts")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeSection === "contracts" ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Contratos</button>
            <button onClick={() => setActiveSection("accounts")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeSection === "accounts" ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Contas</button>
            <button onClick={() => setActiveSection("transfers")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeSection === "transfers" ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Transferências</button>
            <button onClick={() => setActiveSection("catalogs")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeSection === "catalogs" ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Cadastros</button>
          </div>
        </div>

        {activeSection === "contracts" && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
          <h2 className="text-lg font-semibold tracking-tight">Contrato padrão (editável)</h2>
          <p className="mt-1 text-xs text-neutral-600">
            Variáveis disponíveis: `{"{{school_name}}"}`, `{"{{school_code}}"}`, `{"{{school_city}}"}`, `{"{{school_signature_name}}"}`, `{"{{date}}"}`, `{"{{student_name}}"}`, `{"{{payer_name}}"}`, `{"{{description}}"}`, `{"{{total_amount}}"}`, `{"{{installments_count}}"}`, `{"{{first_due_date}}"}`.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-neutral-700">Escola</label>
              <input
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm bg-neutral-100"
                value={schoolName}
                readOnly
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Cidade da escola</label>
              <input
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={schoolCity}
                onChange={(e) => setSchoolCity(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-neutral-700">Nome para assinatura da escola</label>
              <input
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={schoolSignatureName}
                onChange={(e) => setSchoolSignatureName(e.target.value)}
                disabled={busy}
                placeholder="Ex: Direção Pedagógica"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-neutral-700">Texto do contrato</label>
              <div className="mt-1 rounded-xl border border-neutral-300 bg-white p-2">
                <div className="mb-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => formatContract("bold")} className="h-8 rounded border border-neutral-300 px-2 text-xs font-semibold">Negrito</button>
                  <button type="button" onClick={() => formatContract("italic")} className="h-8 rounded border border-neutral-300 px-2 text-xs font-semibold">Itálico</button>
                  <button type="button" onClick={() => formatContract("underline")} className="h-8 rounded border border-neutral-300 px-2 text-xs font-semibold">Sublinhado</button>
                  <button type="button" onClick={() => formatContract("insertUnorderedList")} className="h-8 rounded border border-neutral-300 px-2 text-xs font-semibold">Lista</button>
                  <button type="button" onClick={() => formatContract("insertOrderedList")} className="h-8 rounded border border-neutral-300 px-2 text-xs font-semibold">Numeração</button>
                  <button type="button" onClick={() => formatContract("justifyLeft")} className="h-8 rounded border border-neutral-300 px-2 text-xs font-semibold">Esq</button>
                  <button type="button" onClick={() => formatContract("justifyCenter")} className="h-8 rounded border border-neutral-300 px-2 text-xs font-semibold">Centro</button>
                  <button type="button" onClick={() => formatContract("justifyRight")} className="h-8 rounded border border-neutral-300 px-2 text-xs font-semibold">Dir</button>
                  <button type="button" onClick={() => formatContract("justifyFull")} className="h-8 rounded border border-neutral-300 px-2 text-xs font-semibold">Justificado</button>
                  <select
                    className="h-8 rounded border border-neutral-300 px-2 text-xs font-semibold"
                    onChange={(e) => formatContract("fontName", e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>Fonte</option>
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Verdana">Verdana</option>
                  </select>
                </div>
                <div
                  ref={contractEditorRef}
                  contentEditable={!busy}
                  suppressContentEditableWarning
                  onInput={(e) => setContractTemplate((e.target as HTMLDivElement).innerHTML)}
                  className="min-h-56 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-base leading-7 text-neutral-950 outline-none focus:border-neutral-500"
                />
              </div>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="button"
                onClick={() => setContractTemplate(normalizeTemplateHtml(exampleContractTemplate()))}
                disabled={busy}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 disabled:opacity-60"
              >
                Carregar exemplo de contrato
              </button>
              <button
                type="button"
                onClick={saveContractTemplate}
                disabled={busy}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 disabled:opacity-60"
              >
                Salvar contrato padrão
              </button>
            </div>
          </div>
        </div>
        )}

        {activeSection === "catalogs" && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
          <h2 className="text-lg font-semibold tracking-tight">Cadastros financeiros</h2>
          <p className="mt-1 text-xs text-neutral-600">Pagador e beneficiário vêm do cadastro único em Pessoas. Aqui você cadastra apenas categorias.</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Cadastro único (Pessoas)</h3>
              <div className="mt-3 rounded-xl border border-neutral-200 p-3 text-xs text-neutral-700">
                Cadastre e mantenha fornecedores, pais e responsáveis em <strong>Pessoas</strong>.
                <br />
                Para pagador, use papel <strong>financial_guardian</strong> ou <strong>parent</strong>.
                <br />
                Para contas a pagar, você pode selecionar qualquer pessoa ativa (fornecedor, professor, funcionário, responsável etc.).
              </div>
              <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-neutral-200 p-2">
                {peopleCatalog.map((p) => (
                  <div key={p.id} className="border-b border-neutral-100 px-2 py-2 text-xs text-neutral-800 last:border-b-0">
                    {p.full_name} <span className="text-neutral-500">({(p.role_codes ?? []).join(", ") || "sem papel"})</span>
                  </div>
                ))}
                {peopleCatalog.length === 0 && <div className="px-2 py-2 text-xs text-neutral-600">Nenhuma pessoa cadastrada.</div>}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Nova categoria</h3>
              <form className="mt-3 grid gap-3" onSubmit={createCategory}>
                <input
                  className="h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria"
                  disabled={busy}
                />
                <select
                  className="h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  value={newCategoryFlow}
                  onChange={(e) => setNewCategoryFlow(e.target.value as "payable" | "receivable" | "both")}
                  disabled={busy}
                >
                  <option value="both">Pagar e Receber</option>
                  <option value="payable">Somente Pagar</option>
                  <option value="receivable">Somente Receber</option>
                </select>
                <button className="h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy}>
                  Salvar categoria
                </button>
              </form>
              <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-neutral-200 p-2">
                {categories.map((c) => (
                  <div key={c.id} className="border-b border-neutral-100 px-2 py-2 text-xs text-neutral-800 last:border-b-0">
                    {c.name} <span className="text-neutral-500">({c.flow})</span>
                  </div>
                ))}
                {categories.length === 0 && <div className="px-2 py-2 text-xs text-neutral-600">Nenhuma categoria ainda.</div>}
              </div>
            </div>
          </div>
        </div>
        )}

        {activeSection === "contracts" && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
          <h2 className="text-lg font-semibold tracking-tight">Novo contrato</h2>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={createContract}>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Aluno</label>
              <select
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={busy}
              >
                <option value="">Selecione</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.registration})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Descrição</label>
              <input
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Valor total (R$)</label>
              <input
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                disabled={busy}
                placeholder="1200.00"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Quantidade de parcelas</label>
              <input
                type="number"
                min={1}
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={installmentsCount}
                onChange={(e) => setInstallmentsCount(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Primeiro vencimento</label>
              <input
                type="date"
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Modo de cobrança</label>
              <select
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={billingMode}
                onChange={(e) => setBillingMode(e.target.value as "provider_boleto" | "school_booklet" | "school_booklet_pix")}
                disabled={busy}
              >
                <option value="school_booklet">Carnê (pagamento na escola)</option>
                <option value="school_booklet_pix">Carnê + PIX</option>
                <option value="provider_boleto">Boleto via provedor</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Responsável financeiro principal</label>
              <select
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={payerPersonId}
                onChange={(e) => setPayerPersonId(e.target.value)}
                disabled={busy}
              >
                <option value="">Não definido</option>
                {financialPeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
            {billingMode === "school_booklet_pix" && (
              <div>
                <label className="text-xs font-semibold text-neutral-700">Chave PIX da escola</label>
                <input
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  value={schoolPixKey}
                  onChange={(e) => setSchoolPixKey(e.target.value)}
                  disabled={busy}
                  placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-neutral-700">Instruções de pagamento (opcional)</label>
              <input
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={schoolPaymentInstructions}
                onChange={(e) => setSchoolPaymentInstructions(e.target.value)}
                disabled={busy}
                placeholder="Ex: pagar na secretaria até o vencimento"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-neutral-700">Enviar boletos por e-mail para</label>
              <select
                multiple
                className="mt-1 min-h-24 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={recipientPersonIds}
                onChange={(e) =>
                  setRecipientPersonIds(
                    Array.from(e.target.selectedOptions).map((o) => o.value),
                  )
                }
                disabled={busy}
              >
                {financialPeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} {p.email ? `(${p.email})` : "(sem e-mail)"}
                  </option>
                ))}
              </select>
            </div>
            <button
              disabled={busy}
              className="md:col-span-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Salvando..." : "Criar contrato e gerar parcelas"}
            </button>
          </form>
        </div>
        )}

        {activeSection === "accounts" && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setAccountsSection("current")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${accountsSection === "current" ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Contas correntes</button>
            <button onClick={() => setAccountsSection("cash")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${accountsSection === "cash" ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Caixa</button>
            <button onClick={() => setAccountsSection("payables")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${accountsSection === "payables" ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Contas a pagar</button>
            <button onClick={() => setAccountsSection("receivables")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${accountsSection === "receivables" ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Contas a receber</button>
          </div>

          {accountsSection === "current" && (
          <>
            <h2 className="mt-6 text-lg font-semibold tracking-tight">Contas correntes</h2>
            <form
              className="mt-4 grid gap-3 md:grid-cols-3"
              onSubmit={(e) =>
                createAccount(e, "current", newCurrentAccountName, newCurrentAccountInitialBalance, () => {
                  setNewCurrentAccountName("");
                  setNewCurrentAccountInitialBalance("");
                })
              }
            >
              <div>
                <label className="text-xs font-semibold text-neutral-700">Nome da conta corrente</label>
                <input
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  value={newCurrentAccountName}
                  onChange={(e) => setNewCurrentAccountName(e.target.value)}
                  disabled={busy}
                  placeholder="Ex: Banco principal"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Saldo inicial</label>
                <input
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  value={newCurrentAccountInitialBalance}
                  onChange={(e) => setNewCurrentAccountInitialBalance(e.target.value)}
                  disabled={busy}
                  placeholder="0.00"
                />
              </div>
              <button disabled={busy} className="mt-6 h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-60">
                Criar conta corrente
              </button>
            </form>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {currentAccounts.map((a) => (
                <div key={a.id} className="rounded-xl border border-neutral-200 p-3">
                  <div className="text-sm font-semibold text-neutral-900">{a.name}</div>
                  <div className="text-xs text-neutral-700">Saldo inicial R$ {a.initial_balance.toFixed(2)}</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-700">Saldo atual: R$ {a.current_balance.toFixed(2)}</div>
                </div>
              ))}
              {currentAccounts.length === 0 && <div className="text-sm text-neutral-600">Nenhuma conta corrente cadastrada.</div>}
            </div>
          </>
          )}

          {accountsSection === "cash" && (
          <>
            <h2 className="mt-6 text-lg font-semibold tracking-tight">Caixa</h2>
            <form
              className="mt-4 grid gap-3 md:grid-cols-3"
              onSubmit={(e) =>
                createAccount(e, "cash", newCashAccountName, newCashAccountInitialBalance, () => {
                  setNewCashAccountName("");
                  setNewCashAccountInitialBalance("");
                })
              }
            >
              <div>
                <label className="text-xs font-semibold text-neutral-700">Nome do caixa</label>
                <input
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  value={newCashAccountName}
                  onChange={(e) => setNewCashAccountName(e.target.value)}
                  disabled={busy}
                  placeholder="Ex: Caixa secretaria"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Saldo inicial</label>
                <input
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  value={newCashAccountInitialBalance}
                  onChange={(e) => setNewCashAccountInitialBalance(e.target.value)}
                  disabled={busy}
                  placeholder="0.00"
                />
              </div>
              <button disabled={busy} className="mt-6 h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-60">
                Criar caixa
              </button>
            </form>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {cashAccounts.map((a) => (
                <div key={a.id} className="rounded-xl border border-neutral-200 p-3">
                  <div className="text-sm font-semibold text-neutral-900">{a.name}</div>
                  <div className="text-xs text-neutral-700">Saldo inicial R$ {a.initial_balance.toFixed(2)}</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-700">Saldo atual: R$ {a.current_balance.toFixed(2)}</div>
                </div>
              ))}
              {cashAccounts.length === 0 && <div className="text-sm text-neutral-600">Nenhum caixa cadastrado.</div>}
            </div>
          </>
          )}
        </div>
        )}

        {activeSection === "transfers" && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
          <h2 className="text-lg font-semibold tracking-tight">Transferência entre contas</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-5" onSubmit={createTransfer}>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Conta origem</label>
              <select
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={transferFromAccountId}
                onChange={(e) => setTransferFromAccountId(e.target.value)}
                disabled={busy}
              >
                <option value="">Selecione</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Conta destino</label>
              <select
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={transferToAccountId}
                onChange={(e) => setTransferToAccountId(e.target.value)}
                disabled={busy}
              >
                <option value="">Selecione</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Data</label>
              <input
                type="date"
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Valor</label>
              <input
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                disabled={busy}
                placeholder="0.00"
              />
            </div>
            <button
              disabled={busy}
              className="mt-6 h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              Transferir
            </button>
            <div className="md:col-span-5">
              <label className="text-xs font-semibold text-neutral-700">Observação (opcional)</label>
              <input
                className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                disabled={busy}
                placeholder="Ex: reforço no caixa da escola"
              />
            </div>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-xs text-neutral-800">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-600">
                  <th className="px-2 py-2">Data</th>
                  <th className="px-2 py-2">Origem</th>
                  <th className="px-2 py-2">Destino</th>
                  <th className="px-2 py-2">Valor</th>
                  <th className="px-2 py-2">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-b border-neutral-100">
                    <td className="px-2 py-2">{t.transfer_date}</td>
                    <td className="px-2 py-2">{accounts.find((a) => a.id === t.from_account_id)?.name ?? "-"}</td>
                    <td className="px-2 py-2">{accounts.find((a) => a.id === t.to_account_id)?.name ?? "-"}</td>
                    <td className="px-2 py-2">R$ {t.amount.toFixed(2)}</td>
                    <td className="px-2 py-2">{t.note ?? "-"}</td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr>
                    <td className="px-2 py-2 text-neutral-600" colSpan={5}>Nenhuma transferência registrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {activeSection === "accounts" && accountsSection === "payables" && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
          <h2 className="text-lg font-semibold tracking-tight">Contas a pagar</h2>
          <div className="mt-3">
            <label className="text-xs font-semibold text-neutral-700">Buscar em contas a pagar</label>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm"
              value={payablesSearch}
              onChange={(e) => setPayablesSearch(e.target.value)}
              placeholder="Descrição, beneficiário ou categoria"
            />
          </div>
          <form className="mt-4 grid gap-3 md:grid-cols-5" onSubmit={createPayable}>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-neutral-700">Descrição</label>
              <input className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" value={payableDescription} onChange={(e) => setPayableDescription(e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Beneficiário</label>
              <select className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" value={payableVendorPersonId} onChange={(e) => setPayableVendorPersonId(e.target.value)} disabled={busy}>
                <option value="">Selecione</option>
                {payablePeople.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Categoria</label>
              <select className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" value={payableCategoryId} onChange={(e) => setPayableCategoryId(e.target.value)} disabled={busy}>
                <option value="">Selecione</option>
                {payableCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Vencimento</label>
              <input type="date" className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" value={payableDueDate} onChange={(e) => setPayableDueDate(e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Valor</label>
              <input className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" value={payableAmount} onChange={(e) => setPayableAmount(e.target.value)} disabled={busy} placeholder="0.00" />
            </div>
            <button className="mt-6 h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy}>Adicionar conta a pagar</button>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs text-neutral-800">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-600">
                  <th className="px-2 py-2">Descrição</th>
                  <th className="px-2 py-2">Beneficiário</th>
                  <th className="px-2 py-2">Vencimento</th>
                  <th className="px-2 py-2">Valor</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Conta saída</th>
                  <th className="px-2 py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {payablesFiltered.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-100">
                    <td className="px-2 py-2">{p.description}</td>
                    <td className="px-2 py-2">{p.vendor_name ?? "-"}</td>
                    <td className="px-2 py-2">{p.due_date}</td>
                    <td className="px-2 py-2">R$ {p.amount.toFixed(2)}</td>
                    <td className="px-2 py-2">{payableStatusLabel(p.status)}</td>
                    <td className="px-2 py-2">
                      {p.status === "pending" ? (
                        <select
                          className="h-9 rounded-lg border border-neutral-300 px-2 text-xs"
                          value={payableAccountById[p.id] ?? ""}
                          onChange={(e) => setPayableAccountById((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        >
                          <option value="">Selecione</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      ) : (
                        accounts.find((a) => a.id === p.account_id)?.name ?? "-"
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {p.status === "pending" ? (
                        <button onClick={() => markPayableAsPaid(p.id)} disabled={busy} className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-60">
                          Quitar
                        </button>
                      ) : (
                        <span className="text-neutral-500">Pago {p.paid_at ?? ""}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {payablesFiltered.length === 0 && (
                  <tr>
                    <td className="px-2 py-2 text-neutral-600" colSpan={7}>Nenhuma conta a pagar cadastrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {activeSection === "accounts" && accountsSection === "receivables" && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
          <h2 className="text-lg font-semibold tracking-tight">Contas a receber</h2>
          <p className="mt-1 text-xs text-neutral-600">As parcelas de contrato (boleto/carnê) entram automaticamente aqui com origem de parcela.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-5">
            <div className="md:col-span-1">
              <label className="text-xs font-semibold text-neutral-700">Buscar em contas a receber</label>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={receivablesSearch}
                onChange={(e) => setReceivablesSearch(e.target.value)}
                placeholder="Descrição, pagador ou categoria"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Período do extrato</label>
              <select
                className="mt-1 h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                value={statementPeriodMode}
                onChange={(e) => setStatementPeriodMode(e.target.value as "current_year" | "custom")}
              >
                <option value="current_year">Ano corrente</option>
                <option value="custom">Período personalizado</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-semibold text-neutral-700">Extrato por responsável financeiro</label>
              <div className="mt-1 flex gap-2">
                <select
                  className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  value={statementPayerPersonId}
                  onChange={(e) => setStatementPayerPersonId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {payerPeople.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={loadFinancialGuardianStatement}
                  disabled={statementLoading || busy}
                  className="rounded-xl border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 disabled:opacity-60"
                >
                  {statementLoading ? "Carregando..." : "Ver extrato"}
                </button>
                <button
                  type="button"
                  onClick={printFinancialGuardianStatement}
                  disabled={!statement || statementLoading || busy}
                  className="rounded-xl border border-blue-300 bg-blue-50 px-3 text-xs font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-60"
                >
                  Imprimir extrato
                </button>
              </div>
            </div>
          </div>
          {statementPeriodMode === "custom" && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-neutral-700">Data inicial</label>
                <input
                  type="date"
                  className="mt-1 h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  value={statementDateFrom}
                  onChange={(e) => setStatementDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700">Data final</label>
                <input
                  type="date"
                  className="mt-1 h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm"
                  value={statementDateTo}
                  onChange={(e) => setStatementDateTo(e.target.value)}
                />
              </div>
            </div>
          )}
          {statement && (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Extrato de {statement.person_name}</div>
                  <div className="text-xs text-neutral-600">
                    {statementPeriodMode === "current_year"
                      ? `Ano corrente (${new Date().getFullYear()})`
                      : `Período: ${formatDateBR(statementDateFrom)} a ${formatDateBR(statementDateTo)}`}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                    <div className="font-semibold text-emerald-900">Total pago</div>
                    <div className="text-sm font-bold text-emerald-800">R$ {formatCurrencyBR(statement.total_paid)}</div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                    <div className="font-semibold text-amber-900">Em aberto</div>
                    <div className="text-sm font-bold text-amber-800">R$ {formatCurrencyBR(statement.total_open)}</div>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs">
                    <div className="font-semibold text-sky-900">Saldo pendente total</div>
                    <div className="text-sm font-bold text-sky-800">R$ {formatCurrencyBR(statement.pending_balance_total)}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-xs text-neutral-700 md:grid-cols-2">
                <div>
                  <div><strong>Escola:</strong> {statement.school_name} ({statement.school_code}){statement.school_city ? ` - ${statement.school_city}` : ""}</div>
                  <div><strong>Assinatura escola:</strong> {statement.school_signature_name ?? "-"}</div>
                </div>
                <div>
                  <div><strong>Responsável:</strong> {statement.person_name}</div>
                  <div><strong>Documento:</strong> {statement.person_document ?? "-"}</div>
                  <div><strong>Telefone:</strong> {statement.person_phone ?? "-"}</div>
                  <div><strong>E-mail:</strong> {statement.person_email ?? "-"}</div>
                  <div>
                    <strong>Endereço:</strong>{" "}
                    {[statement.person_street, statement.person_address_number, statement.person_neighborhood, statement.person_city_name, statement.person_state_uf]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </div>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs text-neutral-800">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-600">
                      <th className="px-2 py-2">Descrição</th>
                      <th className="px-2 py-2">Aluno</th>
                      <th className="px-2 py-2">Vencimento</th>
                      <th className="px-2 py-2">Valor</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Recebimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.items.map((it) => (
                      <tr key={it.receivable_id} className="border-b border-neutral-100">
                        <td className="px-2 py-2">{it.description}</td>
                        <td className="px-2 py-2">{it.student_name ?? "-"}</td>
                        <td className="px-2 py-2">{formatDateBR(it.due_date)}</td>
                        <td className="px-2 py-2">R$ {formatCurrencyBR(it.amount)}</td>
                        <td className="px-2 py-2">{receivableStatusLabel(it.status as Receivable["status"])}</td>
                        <td className="px-2 py-2">{it.received_at ? formatDateBR(it.received_at) : "-"}</td>
                      </tr>
                    ))}
                    {statement.items.length === 0 && (
                      <tr>
                        <td className="px-2 py-2 text-neutral-600" colSpan={6}>Nenhum lançamento para este responsável financeiro.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <form className="mt-4 grid gap-3 md:grid-cols-5" onSubmit={createReceivable}>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-neutral-700">Descrição</label>
              <input className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" value={receivableDescription} onChange={(e) => setReceivableDescription(e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Pagador</label>
              <select className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" value={receivablePayerPersonId} onChange={(e) => setReceivablePayerPersonId(e.target.value)} disabled={busy}>
                <option value="">Selecione</option>
                {payerPeople.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Categoria</label>
              <select className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" value={receivableCategoryId} onChange={(e) => setReceivableCategoryId(e.target.value)} disabled={busy}>
                <option value="">Selecione</option>
                {receivableCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Vencimento</label>
              <input type="date" className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" value={receivableDueDate} onChange={(e) => setReceivableDueDate(e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700">Valor</label>
              <input className="mt-1 h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" value={receivableAmount} onChange={(e) => setReceivableAmount(e.target.value)} disabled={busy} placeholder="0.00" />
            </div>
            <button className="mt-6 h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy}>Adicionar conta a receber</button>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs text-neutral-800">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-600">
                  <th className="px-2 py-2">Descrição</th>
                  <th className="px-2 py-2">Pagador</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2">Vencimento</th>
                  <th className="px-2 py-2">Valor</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Conta entrada</th>
                  <th className="px-2 py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {receivablesFiltered.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100">
                    <td className="px-2 py-2">{r.description}</td>
                    <td className="px-2 py-2">{r.payer_name ?? "-"}</td>
                    <td className="px-2 py-2">{r.source_type === "installment" ? "Parcela" : "Manual"}</td>
                    <td className="px-2 py-2">{r.due_date}</td>
                    <td className="px-2 py-2">R$ {r.amount.toFixed(2)}</td>
                    <td className="px-2 py-2">{receivableStatusLabel(r.status)}</td>
                    <td className="px-2 py-2">
                      {r.status === "pending" ? (
                        <select
                          className="h-9 rounded-lg border border-neutral-300 px-2 text-xs"
                          value={receivableAccountById[r.id] ?? ""}
                          onChange={(e) => setReceivableAccountById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        >
                          <option value="">Selecione</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      ) : (
                        accounts.find((a) => a.id === r.account_id)?.name ?? "-"
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {r.status === "pending" ? (
                        <button onClick={() => markReceivableAsReceived(r.id)} disabled={busy} className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60">
                          Receber
                        </button>
                      ) : (
                        <span className="text-neutral-500">Recebido {r.received_at ?? ""}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {receivablesFiltered.length === 0 && (
                  <tr>
                    <td className="px-2 py-2 text-neutral-600" colSpan={8}>Nenhuma conta a receber cadastrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {activeSection === "contracts" && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight">Contratos</h2>
            <div className="text-xs text-neutral-500">{loading ? "Carregando..." : `${contracts.length} contrato(s)`}</div>
          </div>

          <div className="mt-4 space-y-4">
            {!loading && contracts.length === 0 && (
              <div className="text-sm text-neutral-600">Nenhum contrato encontrado.</div>
            )}
            {contracts.map((c) => (
              <div key={c.id} className="rounded-2xl border border-neutral-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-sm text-neutral-800">
                    <div className="font-semibold text-neutral-900">{c.student_name}</div>
                    <div>{c.description}</div>
                    <div>Total: R$ {c.total_amount.toFixed(2)} em {c.installments_count} parcela(s)</div>
                    <div>
                      Cobrança: {c.billing_mode === "provider_boleto" ? "Boleto via provedor" : c.billing_mode === "school_booklet_pix" ? "Carnê + PIX" : "Carnê na escola"}
                    </div>
                    {c.school_payment_instructions && <div>Instruções: {c.school_payment_instructions}</div>}
                    <div>
                      Envio para: {c.recipient_person_ids
                        .map((id) => financialPeopleById.get(id)?.full_name)
                        .filter((name): name is string => Boolean(name))
                        .join(", ") || "Nenhum"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openContractPreview(c)}
                      disabled={busy}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 disabled:opacity-60"
                    >
                      Ver contrato
                    </button>
                    <button
                      onClick={() => generateBoletos(c.id)}
                      disabled={busy}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 disabled:opacity-60"
                    >
                      Gerar cobranças
                    </button>
                    <button
                      onClick={() => sendEmails(c.id)}
                      disabled={busy}
                      className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-60"
                    >
                      Enviar por e-mail
                    </button>
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-xs text-neutral-800">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-600">
                        <th className="px-2 py-2">Parcela</th>
                        <th className="px-2 py-2">Vencimento</th>
                        <th className="px-2 py-2">Valor</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Boleto</th>
                        <th className="px-2 py-2">PIX</th>
                        <th className="px-2 py-2">E-mail</th>
                        <th className="px-2 py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.installments.map((i) => (
                        <tr key={i.id} className="border-b border-neutral-100">
                          <td className="px-2 py-2">{i.installment_number}</td>
                          <td className="px-2 py-2">{i.due_date}</td>
                          <td className="px-2 py-2">R$ {i.amount.toFixed(2)}</td>
                          <td className="px-2 py-2">{installmentStatusLabel(i.status)}</td>
                          <td className="px-2 py-2">
                            {i.boleto_url ? (
                              <a href={i.boleto_url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                                {i.boleto_code}
                              </a>
                            ) : i.boleto_code ? (
                              <button
                                type="button"
                                onClick={() => openBookletPreview(c, i)}
                                className="text-blue-700 underline"
                              >
                                {i.boleto_code}
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-2 py-2">{i.pix_copy_paste ? "Gerado" : "-"}</td>
                          <td className="px-2 py-2">{i.emailed_at ? "Enviado" : "Pendente"}</td>
                          <td className="px-2 py-2">
                            {i.status !== "paid" && (
                              <button
                                onClick={() => markPaid(c.id, i.id)}
                                disabled={busy}
                                className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                              >
                                Marcar pago
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

function escapeHtml(value: string | null | undefined): string {
  const safe = value ?? "";
  return safe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function payableStatusLabel(status: Payable["status"]): string {
  switch (status) {
    case "pending":
      return "Pendente";
    case "paid":
      return "Pago";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

function receivableStatusLabel(status: Receivable["status"]): string {
  switch (status) {
    case "pending":
      return "Pendente";
    case "received":
      return "Recebido";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

function installmentStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pendente";
    case "paid":
      return "Pago";
    case "overdue":
      return "Atrasado";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

function formatCurrencyBR(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateBR(value: string | null | undefined): string {
  if (!value) return "-";
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("pt-BR");
}

function applyTemplate(template: string, data: Record<string, string>): string {
  return Object.entries(data).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template,
  );
}

function normalizeTemplateHtml(template: string): string {
  const raw = (template ?? "").trim();
  if (!raw) return "";
  if (raw.includes("<") && raw.includes(">")) return raw;
  return raw
    .split("\n\n")
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function sanitizeContractHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function defaultContractTemplate(): string {
  return `CONTRATO DE PRESTACAO DE SERVICOS EDUCACIONAIS

Escola: {{school_name}} ({{school_code}})
Cidade: {{school_city}}
Data: {{date}}

Aluno(a): {{student_name}}
Responsavel financeiro: {{payer_name}}

Plano contratado: {{description}}
Valor total: R$ {{total_amount}}
Quantidade de parcelas: {{installments_count}}
Primeiro vencimento: {{first_due_date}}

As partes acima identificadas acordam com as condicoes de prestacao de servicos educacionais e pagamento das mensalidades.

Assinaturas:

____________________________________
Responsavel Financeiro

____________________________________
Escola - {{school_signature_name}}`;
}

function exampleContractTemplate(): string {
  return `CONTRATO DE PRESTACAO DE SERVICOS EDUCACIONAIS

Pelo presente instrumento, de um lado a escola {{school_name}} (codigo {{school_code}}), localizada em {{school_city}}, e, de outro lado, o(a) responsavel financeiro(a) {{payer_name}}, responsavel pelo(a) aluno(a) {{student_name}}, ajustam o presente contrato.

1. OBJETO
A escola prestara servicos educacionais ao(à) aluno(a), conforme proposta pedagogica, calendario escolar e normas internas da instituicao.

2. PLANO E VALORES
Descricao do plano: {{description}}
Valor total contratado: R$ {{total_amount}}
Quantidade de parcelas: {{installments_count}}
Primeiro vencimento: {{first_due_date}}

3. FORMA DE PAGAMENTO
O pagamento devera ser realizado nas datas de vencimento informadas nas cobrancas emitidas pela escola.

4. INADIMPLENCIA
Em caso de atraso, podera haver cobranca de multa, juros e demais encargos permitidos por lei.

5. DISPOSICOES GERAIS
As partes declaram ciencia e concordancia com as clausulas acima.

{{school_city}}, {{date}}.

____________________________________
Responsavel Financeiro

____________________________________
Escola - {{school_signature_name}}`;
}
