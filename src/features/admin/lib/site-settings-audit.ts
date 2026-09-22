import "server-only";

import { Prisma, SiteSettingsChangeOperation, type SiteSettings } from "@/generated/prisma/client";

import { buildAuditChange, type AuditSnapshot } from "@/features/admin/lib/audit-change";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { ensureSiteSettings, SITE_SETTINGS_ID } from "@/lib/site-settings";

export async function updateSiteSettingsWithAudit({
  actorUserId,
  operation,
  data,
  snapshots,
  validate,
}: {
  actorUserId: string;
  operation: SiteSettingsChangeOperation;
  data: Prisma.SiteSettingsUncheckedUpdateInput;
  snapshots: (current: SiteSettings) => { before: AuditSnapshot; after: AuditSnapshot };
  validate?: (tx: Prisma.TransactionClient, current: SiteSettings) => Promise<void>;
}) {
  await ensureSiteSettings();
  return runSerializableTransaction(async (tx) => {
    const current = await tx.siteSettings.findUniqueOrThrow({ where: { id: SITE_SETTINGS_ID } });
    await validate?.(tx, current);
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
  });
}
