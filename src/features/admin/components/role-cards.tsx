import type { AdminUsersPageData } from "@/features/admin/lib/admin-users";

import { AdminPanel } from "./admin-page-shell";
import { RoleBadge } from "./role-badge";

export function RoleCards({
  roleCards,
}: {
  roleCards: AdminUsersPageData["roleCards"];
}) {
  return (
    <AdminPanel
      title="Role a oprávnění"
      description="Pouze dvě jasné role bez dalších meziúrovní a bez složité správy oprávnění."
      denseHeader
    >
      <div className="grid gap-4">
        {roleCards.map((card) => (
          <article
            key={card.role}
            className="rounded-[1.4rem] border border-white/8 bg-white/[0.04] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-medium text-white">{card.title}</h4>
                <p className="mt-2 text-sm leading-6 text-white/68">{card.description}</p>
              </div>
              <RoleBadge role={card.role} />
            </div>

            <div className="mt-4 grid gap-2">
              {card.bullets.map((bullet) => (
                <p key={bullet} className="rounded-[1rem] border border-white/7 bg-black/10 px-3.5 py-3 text-sm leading-6 text-white/78">
                  {bullet}
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </AdminPanel>
  );
}
