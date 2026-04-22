import "server-only";

import { Prisma } from "@prisma/client";

export function isMissingInvitedAtColumnError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2022") {
    return false;
  }

  const column = typeof error.meta?.column === "string" ? error.meta.column : "";

  return column.includes("invitedAt") || String(error.message).includes("invitedAt");
}
