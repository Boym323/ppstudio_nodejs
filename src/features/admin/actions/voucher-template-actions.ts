"use server";

import { AdminRole, VoucherType } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  cloneVoucherTemplateVersion,
  createVoucherTemplateDraft,
  deactivateVoucherTemplate,
  deleteVoucherTemplateDraft,
  publishVoucherTemplate,
  replaceVoucherTemplateMaster,
  updateVoucherTemplateDraft,
} from "@/features/vouchers/lib/voucher-template-domain";
import type { VoucherTemplateLayoutV1 } from "@/features/vouchers/lib/voucher-template-layout";
import { generateResolvedVoucherDigitalPdf } from "@/features/vouchers/lib/voucher-pdf";
import { requireVoucherTemplateById, resolveVoucherTemplate } from "@/features/vouchers/lib/voucher-template-repository";
import { requireRole } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/provider";
import { defaultVoucherTemplateLayout } from "@/features/vouchers/lib/voucher-template-defaults";

export async function createVoucherTemplateAction(formData: FormData) {
  const session = await requireRole([AdminRole.OWNER]);
  const template = await createVoucherTemplateDraft({ familyKey: String(formData.get("familyKey") ?? ""), label: String(formData.get("label") ?? ""), allowedTypes: [VoucherType.VALUE, VoucherType.SERVICE], layout: defaultVoucherTemplateLayout, actorUserId: session.sub });
  redirect(`/admin/vouchery/sablony/${template.id}`);
}

export async function uploadVoucherTemplateMasterAction(formData: FormData) {
  const session = await requireRole([AdminRole.OWNER]);
  const templateId = String(formData.get("templateId") ?? ""); const file = formData.get("master");
  if (!templateId || !(file instanceof File) || file.size === 0 || file.size > 8 * 1024 * 1024 || (file.type && file.type !== "application/pdf")) throw new Error("Vyberte PDF master do 8 MB.");
  await replaceVoucherTemplateMaster(templateId, Buffer.from(await file.arrayBuffer()), session.sub);
  revalidatePath(`/admin/vouchery/sablony/${templateId}`);
  revalidatePath("/admin/nastaveni");
}

export async function saveVoucherTemplateLayoutAction(templateId: string, layout: VoucherTemplateLayoutV1) {
  const session = await requireRole([AdminRole.OWNER]);
  const { requireVoucherTemplateById } = await import("@/features/vouchers/lib/voucher-template-repository");
  const template = await requireVoucherTemplateById(templateId);
  await updateVoucherTemplateDraft(templateId, { layout, allowedTypes: template.allowedTypes, label: template.label, actorUserId: session.sub });
  revalidatePath(`/admin/vouchery/sablony/${templateId}`);
}

export async function publishVoucherTemplateAction(templateId: string) {
  const session = await requireRole([AdminRole.OWNER]);
  await publishVoucherTemplate(templateId, session.sub);
  revalidatePath(`/admin/vouchery/sablony/${templateId}`);
  revalidatePath("/admin/vouchery/sablony");
}

export async function deactivateVoucherTemplateAction(templateId: string) {
  const session = await requireRole([AdminRole.OWNER]);
  await deactivateVoucherTemplate(templateId, session.sub);
  revalidatePath(`/admin/vouchery/sablony/${templateId}`);
  revalidatePath("/admin/vouchery/sablony");
}

export async function cloneVoucherTemplateVersionAction(templateId: string) {
  const session = await requireRole([AdminRole.OWNER]);
  const clone = await cloneVoucherTemplateVersion(templateId, session.sub);
  revalidatePath("/admin/vouchery/sablony");
  redirect(`/admin/vouchery/sablony/${clone.id}`);
}

export async function deleteVoucherTemplateDraftAction(templateId: string) {
  const session = await requireRole([AdminRole.OWNER]);
  await deleteVoucherTemplateDraft(templateId, session.sub);
  revalidatePath("/admin/vouchery/sablony");
  redirect("/admin/vouchery/sablony");
}

export async function sendTestVoucherTemplateEmailAction(formData: FormData) {
  await requireRole([AdminRole.OWNER]);
  const templateId = String(formData.get("templateId") ?? "");
  const recipient = String(formData.get("recipientEmail") ?? "").trim();
  if (!z.email().safeParse(recipient).success) throw new Error("Zadejte platný e-mail pro test.");
  const template = await requireVoucherTemplateById(templateId);
  if (template.status !== "DRAFT") throw new Error("Testovací e-mail lze odeslat pouze z draftu.");
  const resolved = await resolveVoucherTemplate(template);
  const voucher = { templateId, templateKey: template.key, code: "TEST-2026-ABCDEF", type: VoucherType.VALUE, originalValueCzk: 1500, remainingValueCzk: 1500, serviceNameSnapshot: null, servicePriceSnapshotCzk: null, validUntil: new Date("2027-12-31T22:59:59.999Z") } as Parameters<typeof generateResolvedVoucherDigitalPdf>[0];
  const pdf = await generateResolvedVoucherDigitalPdf(voucher, resolved);
  await sendEmail({ to: recipient, subject: `[TEST] Voucher template ${template.key}`, html: `<p>Testovací voucher šablony <strong>${template.label}</strong>.</p>`, text: `Testovací voucher šablony ${template.label}.`, attachments: [{ filename: "voucher-test.pdf", content: Buffer.from(pdf), contentType: "application/pdf" }] });
}
