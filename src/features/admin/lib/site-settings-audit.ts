import "server-only";

import { Prisma, SiteSettingsChangeOperation, type SiteSettings } from "@prisma/client";

import { buildAuditChange, type AuditSnapshot } from "@/features/admin/lib/audit-change";
import { prisma } from "@/lib/prisma";
import { ensureSiteSettings, SITE_SETTINGS_ID } from "@/lib/site-settings";

export async function updateSiteSettingsWithAudit({
  actorUserId,
  operation,
  data,
  snapshots,
}: {
  actorUserId: string;
  operation: SiteSettingsChangeOperation;
  data: Prisma.SiteSettingsUncheckedUpdateInput;
  snapshots: (current: SiteSettings) => { before: AuditSnapshot; after: AuditSnapshot };
}) {
  await ensureSiteSettings();
  return prisma.$transaction(async (tx) => {
    const current = await tx.siteSettings.findUniqueOrThrow({ where: { id: SITE_SETTINGS_ID } });
    const selected = snapshots(current);
    const auditChange = buildAuditChange(selected.before, selected.after);
    if (!auditChange) return current;

    const saved = await tx.siteSettings.update({
      where: { id: SITE_SETTINGS_ID },
      data: { ...data, updatedByUserId: actorUserId },
    });
    await tx.siteSettingsChangeLog.create({
      data: {
        siteSettingsId: SITE_SETTINGS_ID,
        actorUserId,
        operation,
        ...auditChange,
      },
    });
    return saved;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
