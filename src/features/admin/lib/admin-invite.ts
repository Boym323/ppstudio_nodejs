import "server-only";

import { AdminRole } from "@prisma/client";

import { hashAdminInviteToken } from "@/features/admin/lib/admin-invite-token";
import { findAdminInviteTokenWithUserByHash } from "@/features/admin/lib/admin-invite-token-db";

export type AdminInvitePageState =
  | {
      status: "ready";
      userName: string;
      userEmail: string;
      role: AdminRole;
    }
  | {
      status: "invalid" | "expired" | "used";
      message: string;
    };

export async function getAdminInvitePageState(rawToken: string): Promise<AdminInvitePageState> {
  const token = await findAdminInviteTokenWithUserByHash(hashAdminInviteToken(rawToken));

  if (!token || !token.user) {
    return {
      status: "invalid",
      message: "Pozvánka nebyla nalezena nebo je neplatná.",
    };
  }

  if (token.revokedAt || token.usedAt) {
    return {
      status: "used",
      message: "Tato pozvánka už byla použitá nebo zneplatněná. Požádejte o novou.",
    };
  }

  if (token.expiresAt <= new Date()) {
    return {
      status: "expired",
      message: "Pozvánka už vypršela. Požádejte o nové zaslání pozvánky.",
    };
  }

  if (!token.user.isActive) {
    return {
      status: "invalid",
      message: "Tento přístup je deaktivovaný. Kontaktujte prosím majitele studia.",
    };
  }

  return {
    status: "ready",
    userName: token.user.name,
    userEmail: token.user.email,
    role: token.user.role,
  };
}
