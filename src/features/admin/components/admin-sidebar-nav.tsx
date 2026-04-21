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
      <div className="space-y-1.5 border-b border-white/8 pb-3.5">
        <p className="text-[10px] uppercase tracking-[0.32em] text-white/42">
          {currentArea === "owner" ? "Owner Admin" : "Provoz salonu"}
        </p>
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-white">PP Studio</h1>
          <p className="text-xs text-white/50">{userName}</p>
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-white/34">
          {currentRole === AdminRole.OWNER ? "role owner" : "role provoz"}
        </p>
      </div>

      <nav className="mt-3.5 grid gap-1.5">
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
                "rounded-2xl border px-3 py-2.5 transition",
                isActive
                  ? "border-[var(--color-accent)]/46 bg-[rgba(190,160,120,0.14)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.24)]"
                  : "border-transparent text-white/66 hover:border-white/8 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-white/42">
                {item.slug === "volne-terminy" || isActive ? item.description : item.description.split(".")[0]}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
