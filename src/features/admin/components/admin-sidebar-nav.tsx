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
      <div className="space-y-1.5 border-b border-white/7 pb-3">
        <p className="text-[10px] uppercase tracking-[0.32em] text-white/34">
          {currentArea === "owner" ? "Owner Admin" : "Provoz salonu"}
        </p>
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-white">PP Studio</h1>
          <p className="text-xs text-white/42">{userName}</p>
        </div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/24">
          {currentRole === AdminRole.OWNER ? "role owner" : "role provoz"}
        </p>
      </div>

      <nav className="mt-3 grid gap-1">
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
                "rounded-xl border px-3 py-2.5 transition",
                isActive
                  ? "border-[var(--color-accent)]/36 bg-[rgba(190,160,120,0.1)] text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
                  : "border-transparent text-white/54 hover:border-white/6 hover:bg-white/[0.035] hover:text-white/84",
              )}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              {isActive ? (
                <span className="mt-1 block text-[11px] leading-4 text-white/34">
                  {item.description}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
