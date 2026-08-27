"use server";
import { z } from "zod";
import { type AdminArea } from "@/config/navigation";
import { MediaCollectionType } from "@/generated/prisma/client";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import { MEDIA_PICKER_PAGE_SIZE, searchMediaPickerAssets } from "@/features/media/lib/media-picker-query";

const scopeSchema = z.discriminatedUnion("type", [z.object({ type: z.literal("GENERAL"), section: z.enum(["SETTINGS", "SERVICES"]) }), z.object({ type: z.literal("COLLECTION"), collectionType: z.enum([MediaCollectionType.STUDIO_GALLERY, MediaCollectionType.CERTIFICATES]) }), z.object({ type: z.literal("REFERENCES") }), z.object({ type: z.literal("SERVICE_GALLERY"), serviceId: z.cuid() })]);
const inputSchema = z.object({ area: z.enum(["owner", "salon"]), search: z.string().trim().max(120).default(""), page: z.number().int().min(1).max(10_000), pageSize: z.number().int().min(1).max(MEDIA_PICKER_PAGE_SIZE).default(MEDIA_PICKER_PAGE_SIZE), scope: scopeSchema });
export type MediaPickerActionInput = z.input<typeof inputSchema>;
export async function searchMediaPickerAssetsAction(input: MediaPickerActionInput) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "error" as const, message: "Neplatné parametry výběru médií." };
  const { area, scope, ...query } = parsed.data;
  await requireAdminSectionAccess(area as AdminArea, scope.type === "GENERAL" ? (scope.section === "SETTINGS" ? "nastaveni" : "sluzby") : scope.type === "SERVICE_GALLERY" ? "sluzby" : "media");
  return { status: "success" as const, data: await searchMediaPickerAssets({ ...query, scope }) };
}
