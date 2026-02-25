"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE;

function MenuIcon({ href }: { href: string }) {
  const common = "h-4 w-4 shrink-0";
  switch (href) {
    case "/dashboard":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-10h8V3h-8v8z" fill="currentColor" />
        </svg>
      );
    case "/students":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M12 3 2 8l10 5 8-4v6h2V8L12 3zm-6 9v3c0 2 3 4 6 4s6-2 6-4v-3l-6 3-6-3z" fill="currentColor" />
        </svg>
      );
    case "/guardians":
    case "/cadastros":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M16 11a4 4 0 1 0-3.999-4A4 4 0 0 0 16 11zM8 12a3 3 0 1 0-.001-6.001A3 3 0 0 0 8 12zm0 2c-2.67 0-8 1.34-8 4v2h10v-2c0-1.2.6-2.25 1.58-3.1C10.48 14.36 9.03 14 8 14zm8 0c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />
        </svg>
      );
    case "/teachers":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M21 3H3a2 2 0 0 0-2 2v11h2V5h18v11h2V5a2 2 0 0 0-2-2zM8 21h8v-2H8v2zm4-14-5 3 5 3 5-3-5-3z" fill="currentColor" />
        </svg>
      );
    case "/classes":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M4 4h16v4H4V4zm0 6h10v10H4V10zm12 0h4v4h-4v-4zm0 6h4v4h-4v-4z" fill="currentColor" />
        </svg>
      );
    case "/subjects":
    case "/terms":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5L14 3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2z" fill="currentColor" />
        </svg>
      );
    case "/attendance":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM9.4 17.6 6.8 15l1.4-1.4 1.2 1.2 4.4-4.4 1.4 1.4-5.8 5.8z" fill="currentColor" />
        </svg>
      );
    case "/gradebook":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M19 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM8 0h11a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4zM3 6h1v12H3V6zm8 2h7v2h-7V8zm0 4h7v2h-7v-2zm0 4h5v2h-5v-2z" fill="currentColor" />
        </svg>
      );
    case "/financial":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M3 5h18v2H3V5zm1 4h16a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a1 1 0 0 1 1-1zm3 4v2h4v-2H7zm8 0v2h2v-2h-2z" fill="currentColor" />
        </svg>
      );
    case "/reports":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M4 20h16v2H2V2h2v18zm3-3h2v-7H7v7zm4 0h2V6h-2v11zm4 0h2v-4h-2v4z" fill="currentColor" />
        </svg>
      );
    case "/settings":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="m19.14 12.94.86-.49a1 1 0 0 0 .36-1.37l-1-1.73a1 1 0 0 0-1.31-.43l-.87.35a7.04 7.04 0 0 0-1.55-.9l-.13-.93A1 1 0 0 0 14.51 6h-2a1 1 0 0 0-.99.84l-.14.93c-.56.22-1.08.53-1.56.9l-.86-.35a1 1 0 0 0-1.31.43l-1 1.73a1 1 0 0 0 .36 1.37l.86.49a7.27 7.27 0 0 0 0 1.8l-.86.49a1 1 0 0 0-.36 1.37l1 1.73a1 1 0 0 0 1.31.43l.86-.35c.48.38 1 .68 1.56.9l.14.93a1 1 0 0 0 .99.84h2a1 1 0 0 0 .99-.84l.13-.93c.57-.22 1.09-.52 1.55-.9l.87.35a1 1 0 0 0 1.31-.43l1-1.73a1 1 0 0 0-.36-1.37l-.86-.49a7.27 7.27 0 0 0 0-1.8zM13.5 12a2.5 2.5 0 1 1-5.001-.001A2.5 2.5 0 0 1 13.5 12z" fill="currentColor" />
        </svg>
      );
    case "/admin/clients":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M12 2 2 7v2h20V7L12 2zM4 11h2v8H4v-8zm4 0h2v8H8v-8zm4 0h2v8h-2v-8zm4 0h2v8h-2v-8zM2 21h20v2H2v-2z" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
        </svg>
      );
  }
}

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [tenantLabel, setTenantLabel] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function getLocalTenantLabel(currentPath: string) {
    if (typeof window === "undefined") return "";
    if (currentPath.startsWith("/admin")) return "Admin SaaS";

    const schoolName = localStorage.getItem("school_name")?.trim() ?? "";
    const schoolCode = localStorage.getItem("school_code")?.trim() ?? "";
    const tenantId = localStorage.getItem("tenant_id") ?? "";

    if (schoolName.length > 0) return schoolName;
    if (schoolCode.length > 0) return `Escola ${schoolCode}`;
    if (tenantId.length > 0) return `Tenant ${tenantId.slice(0, 8)}`;
    return "";
  }

  useEffect(() => {
    const refreshTenantLabel = () => {
      Promise.resolve().then(() => setTenantLabel(getLocalTenantLabel(pathname)));
    };

    const isPlatformAdminPath = pathname.startsWith("/admin");

    if (isPlatformAdminPath) {
      const platformToken = localStorage.getItem("platform_token");
      if (!platformToken) {
        router.replace("/platform/login");
        return;
      }
      refreshTenantLabel();
      return;
    }

    const token = localStorage.getItem("token");
    const tenantId = localStorage.getItem("tenant_id");
    if (!token || !tenantId) {
      router.replace("/login");
      return;
    }

    refreshTenantLabel();
    if (!API) return;

    void fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as {
          school_name?: string;
          school_code?: string;
        };
      })
      .then((data) => {
        if (!data) return;
        if (data.school_name) localStorage.setItem("school_name", data.school_name);
        if (data.school_code) localStorage.setItem("school_code", data.school_code);
        refreshTenantLabel();
      })
      .catch(() => {
        // Sem impacto crítico: mantém fallback atual.
        refreshTenantLabel();
      });
  }, [pathname, router]);

  const isAdmin = pathname.startsWith("/admin");
  const menuItems = isAdmin
    ? [{ href: "/admin/clients", label: "Clientes SaaS" }]
    : [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/students", label: "Alunos" },
        { href: "/guardians", label: "Resp. Vinculados" },
        { href: "/teachers", label: "Professores" },
        { href: "/classes", label: "Turmas" },
        { href: "/subjects", label: "Disciplinas" },
        { href: "/terms", label: "Períodos" },
        { href: "/attendance", label: "Presença" },
        { href: "/gradebook", label: "Boletim" },
        { href: "/financial", label: "Financeiro" },
        { href: "/reports", label: "Relatórios" },
        { href: "/cadastros", label: "Cadastros" },
        { href: "/settings", label: "Configurações" },
      ];

  function itemClass(href: string) {
    const active = pathname === href;
    if (active) return "rounded-xl bg-blue-900 px-3 py-2 text-sm font-semibold text-white";
    return "rounded-xl px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100";
  }

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-neutral-300 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 lg:hidden"
            >
              Menu
            </button>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Unidade</div>
          </div>
          <div suppressHydrationWarning className="truncate text-sm font-bold text-neutral-950">
            {tenantLabel}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl gap-4 px-4 py-4">
        <aside className="hidden w-56 shrink-0 rounded-2xl border border-neutral-200 bg-white p-3 shadow lg:block">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Navegação</div>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  router.push(item.href);
                }}
                className={`w-full text-left ${itemClass(item.href)}`}
              >
                <span className="inline-flex items-center gap-2">
                  <MenuIcon href={item.href} />
                  <span>{item.label}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/35"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
            />
            <div className="absolute left-0 top-0 h-full w-72 border-r border-neutral-200 bg-white p-4 shadow-xl">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Navegação</div>
              <nav className="space-y-1">
                {menuItems.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push(item.href);
                    }}
                    className={`w-full text-left ${itemClass(item.href)}`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <MenuIcon href={item.href} />
                      <span>{item.label}</span>
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
