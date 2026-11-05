"use server";

import { SignJWT, jwtVerify } from "jose";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "@/config/env";
import { type ClientMergeActionState } from "@/features/admin/actions/client-merge-action-state";
import { ClientMergeError, mergeClientProfiles } from "@/features/admin/lib/client-merge";
import { loadClientMergePreview } from "@/features/admin/lib/client-merge-preview";
import { normalizeClientEmail } from "@/features/booking/lib/booking-public";
import { requireAdminArea } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const previewSchema = z.object({
  sourceClientId: z.string().trim().min(1).max(64),
  targetEmail: z.string().trim().pipe(z.email()).pipe(z.string().max(254)),
});
const confirmationSchema = z.object({
  previewToken: z.string().min(1).max(4096),
  confirmSourceEmail: z.string().trim().min(1).max(254),
  nameChoice: z.enum(["source", "target"]),
  phoneChoice: z.enum(["source", "target"]),
  confirmEffects: z.literal("on"),
});
const claimsSchema = z.object({
  sub: z.string(),
  kind: z.literal("client-merge-preview-v1"),
  sourceId: z.string(),
  targetId: z.string(),
  sourceEmail: z.string(),
  targetEmail: z.string(),
  fingerprint: z.string().length(64),
});
const key = () => new TextEncoder().encode(env.ADMIN_SESSION_SECRET);

function readFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function mergeClientProfilesAction(
  _previousState: ClientMergeActionState,
  formData: FormData,
): Promise<ClientMergeActionState> {
  const session = await requireAdminArea("owner");
  if (readFormString(formData, "intent") === "reset") return { status: "idle" };
  if (readFormString(formData, "intent") === "preview") {
    const parsed = previewSchema.safeParse({
      sourceClientId: readFormString(formData, "sourceClientId"),
      targetEmail: readFormString(formData, "targetEmail"),
    });
    if (!parsed.success) return { status: "error", formError: "Zadejte platný e-mail cílového profilu." };

    const targets = await prisma.client.findMany({
      where: { email: { equals: normalizeClientEmail(parsed.data.targetEmail), mode: "insensitive" }, isActive: true },
      select: { id: true },
      take: 2,
    });
    if (targets.length !== 1) return { status: "error", formError: "Cílový e-mail musí jednoznačně odpovídat jednomu aktivnímu profilu." };
    if (targets[0]!.id === parsed.data.sourceClientId) return { status: "error", formError: "Cílový profil musí být jiný než archivovaný profil." };
    const preview = await prisma.$transaction(
      (tx) => loadClientMergePreview(parsed.data.sourceClientId, targets[0]!.id, tx),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    if (!preview || normalizeClientEmail(preview.target.email) !== normalizeClientEmail(parsed.data.targetEmail)) {
      return { status: "error", formError: "Profily už nejsou dostupné nebo se jejich e-mail změnil. Obnovte stránku." };
    }

    const previewToken = await new SignJWT({
      kind: "client-merge-preview-v1",
      sourceId: preview.source.id,
      targetId: preview.target.id,
      sourceEmail: preview.source.email,
      targetEmail: preview.target.email,
      fingerprint: preview.fingerprint,
    }).setProtectedHeader({ alg: "HS256" }).setSubject(session.sub).setIssuedAt().setExpirationTime("15m").sign(key());
    return { status: "preview", preview, previewToken };
  }

  const parsed = confirmationSchema.safeParse({
    previewToken: readFormString(formData, "previewToken"),
    confirmSourceEmail: readFormString(formData, "confirmSourceEmail"),
    nameChoice: readFormString(formData, "nameChoice"),
    phoneChoice: readFormString(formData, "phoneChoice"),
    confirmEffects: readFormString(formData, "confirmEffects"),
  });
  if (!parsed.success) return { status: "error", formError: "Vyberte jméno a telefon a potvrďte sloučení. Poté znovu načtěte náhled." };

  let claims: z.infer<typeof claimsSchema>;
  try {
    claims = claimsSchema.parse((await jwtVerify(parsed.data.previewToken, key(), { algorithms: ["HS256"] })).payload);
    if (claims.sub !== session.sub) throw new Error("Jiný vlastník náhledu.");
  } catch {
    return { status: "error", formError: "Náhled vypršel nebo není platný. Načtěte jej znovu." };
  }
  if (normalizeClientEmail(claims.sourceEmail) !== normalizeClientEmail(parsed.data.confirmSourceEmail)) {
    return { status: "error", formError: "Potvrzovací e-mail nesouhlasí s archivovaným profilem. Načtěte náhled znovu." };
  }

  let result: Awaited<ReturnType<typeof mergeClientProfiles>>;
  try {
    result = await mergeClientProfiles({
      sourceClientId: claims.sourceId,
      targetClientId: claims.targetId,
      actorUserId: session.sub,
      expectedSourceEmail: claims.sourceEmail,
      expectedTargetEmail: claims.targetEmail,
      expectedFingerprint: claims.fingerprint,
      nameChoice: parsed.data.nameChoice,
      phoneChoice: parsed.data.phoneChoice,
    });
  } catch (error) {
    if (error instanceof ClientMergeError) return { status: "error", formError: error.message };
    console.error("Failed to merge client profiles", error);
    return { status: "error", formError: "Sloučení se nepodařilo bezpečně dokončit. Obnovte stránku a načtěte nový náhled." };
  }

  try {
    for (const path of ["/admin", "/admin/provoz", "/admin/klienti", "/admin/provoz/klienti", "/admin/rezervace", "/admin/provoz/rezervace", `/admin/klienti/${claims.sourceId}`, `/admin/klienti/${claims.targetId}`, `/admin/provoz/klienti/${claims.sourceId}`, `/admin/provoz/klienti/${claims.targetId}`, "/admin/email-logy"]) revalidatePath(path);
    for (const id of result.affectedBookingIds) {
      revalidatePath(`/admin/rezervace/${id}`);
      revalidatePath(`/admin/provoz/rezervace/${id}`);
    }
    for (const id of result.affectedEmailLogIds) revalidatePath(`/admin/email-logy/${id}`);
  } catch (error) {
    console.error("Failed to refresh client pages after merge", error);
  }
  return {
    status: "success",
    targetHref: `/admin/klienti/${claims.targetId}`,
    successMessage: `Profily jsou sloučené. Přesunuto rezervací: ${result.movedBookingCount}, e-mailových záznamů: ${result.movedEmailLogCount}. Nová potvrzení: ${result.refreshedBookingCount}.`,
  };
}
