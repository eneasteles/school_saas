"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const tenantId = localStorage.getItem("tenant_id");
    if (!token || !tenantId) router.replace("/login");
  }, [router]);

  return <>{children}</>;
}
