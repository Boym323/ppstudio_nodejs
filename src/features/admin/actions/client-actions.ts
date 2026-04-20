"use server";

import { revalidatePath } from "next/cache";

import { type AdminArea } from "@/config/navigation";
import { type UpdateClientNoteActionState } from "@/features/admin/actions/update-client-note-action-state";
import { updateClientNoteSchema } from "@/features/admin/lib/admin-client-validation";
import { requireAdminArea } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function revalidateClientPaths(clientId: string) {
  const paths = [
    "/admin",
    "/admin/klienti",
    `/admin/klienti/${clientId}`,
    "/admin/provoz",
    "/admin/provoz/klienti",
    `/admin/provoz/klienti/${clientId}`,
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function updateClientNoteAction(
  _previousState: UpdateClientNoteActionState,
  formData: FormData,
): Promise<UpdateClientNoteActionState> {
  const parsed = updateClientNoteSchema.safeParse({
    area: readFormString(formData, "area"),
    clientId: readFormString(formData, "clientId"),
    internalNote: readFormString(formData, "internalNote"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Poznámku se nepodařilo uložit. Zkontrolujte prosím formulář.",
      fieldErrors: {
        internalNote: fieldErrors.internalNote?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  await requireAdminArea(area);

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { id: true },
  });

  if (!client) {
    return {
      status: "error",
      formError: "Klientku se nepodařilo najít.",
    };
  }

  await prisma.client.update({
    where: { id: client.id },
    data: {
      internalNote: parsed.data.internalNote || null,
    },
  });

  revalidateClientPaths(client.id);

  return {
    status: "success",
    successMessage: "Interní poznámka je uložená.",
  };
}
