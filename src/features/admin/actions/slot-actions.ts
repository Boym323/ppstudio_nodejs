"use server";

import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { type AdminArea } from "@/config/navigation";
import {
  AdminSlotError,
  createAdminSlot,
  deleteAdminSlot,
  getAdminSlotDetailHref,
  getAdminSlotListHref,
  parseSlotDateInput,
  updateAdminSlot,
  updateAdminSlotStatus,
} from "@/features/admin/lib/admin-slots";
import { requireAdminArea } from "@/lib/auth/session";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readFormStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

const upsertSlotSchema = z.object({
  area: z.enum(["owner", "salon"]),
  slotId: z.string().trim().max(64).optional().or(z.literal("")),
  startsAt: z.string().trim().min(1, "Vyplňte začátek slotu."),
  endsAt: z.string().trim().min(1, "Vyplňte konec slotu."),
  capacity: z.coerce.number().int().min(1, "Kapacita musí být alespoň 1."),
  status: z.nativeEnum(AvailabilitySlotStatus),
  serviceRestrictionMode: z.nativeEnum(AvailabilitySlotServiceRestrictionMode),
  publicNote: z.string().trim().max(240, "Veřejná poznámka je příliš dlouhá.").optional(),
  internalNote: z.string().trim().max(1000, "Interní poznámka je příliš dlouhá.").optional(),
  serviceIds: z.array(z.string().trim().min(1)).default([]),
});

const slotStatusActionSchema = z.object({
  area: z.enum(["owner", "salon"]),
  slotId: z.string().trim().min(1).max(64),
  nextStatus: z.nativeEnum(AvailabilitySlotStatus),
});

const deleteSlotSchema = z.object({
  area: z.enum(["owner", "salon"]),
  slotId: z.string().trim().min(1).max(64),
});

export type UpsertSlotActionState = {
  status: "idle" | "error" | "success";
  formError?: string;
  fieldErrors?: Partial<
    Record<
      "startsAt" | "endsAt" | "capacity" | "status" | "serviceIds" | "publicNote" | "internalNote",
      string
    >
  >;
  redirectTo?: string;
};

function revalidateSlotPaths(slotId: string) {
  const paths = [
    "/admin",
    "/admin/volne-terminy",
    `/admin/volne-terminy/${slotId}`,
    `/admin/volne-terminy/${slotId}/upravit`,
    "/admin/provoz",
    "/admin/provoz/volne-terminy",
    `/admin/provoz/volne-terminy/${slotId}`,
    `/admin/provoz/volne-terminy/${slotId}/upravit`,
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
}

function mapSlotError(error: unknown): UpsertSlotActionState {
  if (error instanceof AdminSlotError) {
    return {
      status: "error",
      formError: error.message,
      fieldErrors: error.fieldErrors,
    };
  }

  return {
    status: "error",
    formError: "Slot se nepodařilo uložit kvůli nečekané chybě.",
  };
}

async function persistSlotFromForm(
  parsed: z.infer<typeof upsertSlotSchema>,
  actorUserId: string,
) {
  const startsAt = parseSlotDateInput(parsed.startsAt);
  const endsAt = parseSlotDateInput(parsed.endsAt);

  const payload = {
    startsAt,
    endsAt,
    capacity: parsed.capacity,
    status: parsed.status,
    serviceRestrictionMode: parsed.serviceRestrictionMode,
    publicNote: parsed.publicNote,
    internalNote: parsed.internalNote,
    serviceIds: parsed.serviceIds,
    actorUserId,
  };

  if (parsed.slotId) {
    const result = await updateAdminSlot(parsed.slotId, payload);
    return { id: result.id, flash: "updated" as const };
  }

  const result = await createAdminSlot(payload);
  return { id: result.id, flash: "created" as const };
}

export async function upsertSlotAction(
  _previousState: UpsertSlotActionState,
  formData: FormData,
): Promise<UpsertSlotActionState> {
  const parsed = upsertSlotSchema.safeParse({
    area: readFormString(formData, "area"),
    slotId: readFormString(formData, "slotId"),
    startsAt: readFormString(formData, "startsAt"),
    endsAt: readFormString(formData, "endsAt"),
    capacity: readFormString(formData, "capacity"),
    status: readFormString(formData, "status"),
    serviceRestrictionMode: readFormString(formData, "serviceRestrictionMode"),
    publicNote: readFormString(formData, "publicNote"),
    internalNote: readFormString(formData, "internalNote"),
    serviceIds: readFormStringList(formData, "serviceIds"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      fieldErrors: {
        startsAt: fieldErrors.startsAt?.[0],
        endsAt: fieldErrors.endsAt?.[0],
        capacity: fieldErrors.capacity?.[0],
        status: fieldErrors.status?.[0],
        serviceIds: fieldErrors.serviceIds?.[0],
        publicNote: fieldErrors.publicNote?.[0],
        internalNote: fieldErrors.internalNote?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const session = await requireAdminArea(area);

  try {
    const result = await persistSlotFromForm(parsed.data, session.sub);
    revalidateSlotPaths(result.id);

    return {
      status: "success",
      redirectTo: `${getAdminSlotDetailHref(area, result.id)}?flash=${result.flash}`,
    };
  } catch (error) {
    return mapSlotError(error);
  }
}

export async function changeSlotStatusAction(formData: FormData) {
  const parsed = slotStatusActionSchema.safeParse({
    area: readFormString(formData, "area"),
    slotId: readFormString(formData, "slotId"),
    nextStatus: readFormString(formData, "nextStatus"),
  });

  if (!parsed.success) {
    redirect("/admin");
  }

  const area = parsed.data.area as AdminArea;
  await requireAdminArea(area);

  try {
    await updateAdminSlotStatus(parsed.data.slotId, parsed.data.nextStatus);
  } catch {
    redirect(getAdminSlotDetailHref(area, parsed.data.slotId));
  }

  revalidateSlotPaths(parsed.data.slotId);
  redirect(`${getAdminSlotDetailHref(area, parsed.data.slotId)}?flash=status-updated`);
}

export async function deleteSlotAction(formData: FormData) {
  const parsed = deleteSlotSchema.safeParse({
    area: readFormString(formData, "area"),
    slotId: readFormString(formData, "slotId"),
  });

  if (!parsed.success) {
    redirect("/admin");
  }

  const area = parsed.data.area as AdminArea;
  await requireAdminArea(area);

  try {
    await deleteAdminSlot(parsed.data.slotId);
  } catch {
    redirect(getAdminSlotDetailHref(area, parsed.data.slotId));
  }

  revalidateSlotPaths(parsed.data.slotId);
  redirect(`${getAdminSlotListHref(area)}?flash=deleted`);
}
