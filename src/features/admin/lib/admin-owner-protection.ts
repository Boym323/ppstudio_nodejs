import "server-only";

import { AdminRole, AdminUserAuditOperation, Prisma } from "@/generated/prisma/client";

import { buildAuditChange } from "@/features/admin/lib/audit-change";
import { runSerializableTransaction } from "@/lib/serializable-transaction";

export const LAST_ACTIVE_OWNER_MESSAGE =
  "Nelze odebrat posledního aktivního OWNERa. Nejdřív aktivujte nebo povyšte další účet OWNER.";

type OwnerMutation = {
  userId: string;
  actorUserId: string;
  role?: AdminRole;
  isActive?: boolean;
};

export type OwnerMutationResult = "updated" | "not-found" | "last-active-owner";

export function wouldRemoveLastActiveOwner({
  currentRole,
  currentIsActive,
  nextRole,
  nextIsActive,
  activeOwnerCount,
}: {
  currentRole: AdminRole;
  currentIsActive: boolean;
  nextRole: AdminRole;
  nextIsActive: boolean;
  activeOwnerCount: number;
}) {
  return (
    currentRole === AdminRole.OWNER &&
    currentIsActive &&
    (nextRole !== AdminRole.OWNER || !nextIsActive) &&
    activeOwnerCount <= 1
  );
}

/**
 * Jediná cesta pro degradaci role nebo deaktivaci admina. Serializovatelná
 * transakce brání tomu, aby dva souběžné požadavky odebraly dva poslední ownery.
 */
export async function updateAdminUserWithOwnerProtection(
  mutation: OwnerMutation,
): Promise<OwnerMutationResult> {
  return runSerializableTransaction(
    async (tx) => {
      const target = await tx.adminUser.findUnique({
        where: { id: mutation.userId },
        select: { id: true, role: true, isActive: true },
      });

      if (!target) {
        return "not-found";
      }

      const nextRole = mutation.role ?? target.role;
      const nextIsActive = mutation.isActive ?? target.isActive;
      const auditChange = buildAuditChange(
        { role: target.role, isActive: target.isActive },
        { role: nextRole, isActive: nextIsActive },
      );

      if (!auditChange) {
        return "updated";
      }
      if (target.role === AdminRole.OWNER && target.isActive) {
        const activeOwnerCount = await tx.adminUser.count({
          where: { role: AdminRole.OWNER, isActive: true },
        });

        if (
          wouldRemoveLastActiveOwner({
            currentRole: target.role,
            currentIsActive: target.isActive,
            nextRole,
            nextIsActive,
            activeOwnerCount,
          })
        ) {
          return "last-active-owner";
        }
      }

      await tx.adminUser.update({
        where: { id: target.id },
        data: {
          ...(mutation.role ? { role: mutation.role } : {}),
          ...(mutation.isActive === undefined ? {} : { isActive: mutation.isActive }),
        },
      });

      await tx.adminUserAuditEvent.create({
        data: {
          targetUserId: target.id,
          actorUserId: mutation.actorUserId,
          operation: mutation.role !== undefined
            ? AdminUserAuditOperation.CHANGE_ROLE
            : nextIsActive
              ? AdminUserAuditOperation.ACTIVATE
              : AdminUserAuditOperation.DEACTIVATE,
          ...auditChange,
        },
      });

      if (mutation.isActive === false) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "AdminUserInviteToken"
          SET "revokedAt" = NOW(), "updatedAt" = NOW()
          WHERE "userId" = ${target.id}
            AND "usedAt" IS NULL
            AND "revokedAt" IS NULL
        `);
      }

      return "updated";
    },
  );
}
