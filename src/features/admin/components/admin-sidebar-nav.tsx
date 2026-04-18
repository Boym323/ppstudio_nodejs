"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdminRole } from "@prisma/client";

import { type AdminArea, getAdminNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

type AdminSidebarNavProps = {
  currentRole: AdminRole;
  userName: string;
};

function getCurrentArea(pathname: string): AdminArea {
  return pathname.startsWith("/admin/provoz") ? "salon" : "owner";
}

export function AdminSidebarNav({
  currentRole,
  userName,
}: AdminSidebarNavProps) {
  const pathname = usePathname();
  const currentArea = getCurrentArea(pathname);
  const navigation = getAdminNavigation(currentArea, currentRole);

  return (
    <>
      <div className="space-y-3 border-b border-white/10 pb-5">
        <p className="text-xs uppercase tracking-[0.35em] text-white/50">
          {currentArea === "owner" ? "Owner Admin" : "Provozní Admin"}
        </p>
        <h1 className="font-display text-3xl text-white">PP Studio</h1>
        <p className="text-sm leading-6 text-white/70">
          Přihlášen: {userName} • {currentRole === AdminRole.OWNER ? "ADMIN" : "SALON"}
        </p>
        <p className="text-sm leading-6 text-white/56">
          {currentArea === "owner"
            ? "Plný backoffice pro majitele. Včetně řízení služeb, přístupů a technických logů."
            : "Rychlé provozní rozhraní pro recepci a běžný chod salonu bez technických detailů."}
        </p>
      </div>

      <nav className="mt-5 grid gap-2">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" &&
              item.href !== "/admin/provoz" &&
              pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-3xl border border-transparent px-4 py-3 transition",
                isActive
                  ? "border-[var(--color-accent)] bg-white/12 text-white shadow-[0_12px_32px_rgba(0,0,0,0.22)]"
                  : "text-white/72 hover:border-white/10 hover:bg-white/8 hover:text-white",
              )}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 text-white/56">{item.description}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
