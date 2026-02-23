"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE;

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
                {item.label}
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
                    {item.label}
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
