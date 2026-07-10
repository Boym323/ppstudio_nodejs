import "server-only";

import { createHash } from "node:crypto";

import { AdminRole, BookingSubmissionOutcome } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

export async function recoverAdminOwner({
  email,
  name,
  password,
}: {
  email: string;
  name: string;
  password: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();
  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.adminUser.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        name: normalizedName,
        passwordHash,
        role: AdminRole.OWNER,
        isActive: true,
      },
      update: {
        name: normalizedName,
        passwordHash,
        role: AdminRole.OWNER,
        isActive: true,
      },
      select: { id: true, email: true, name: true },
    });

    await tx.adminUserInviteToken.updateMany({
      where: { userId: user.id, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.bookingSubmissionLog.create({
      data: {
        outcome: BookingSubmissionOutcome.SUCCESS,
        failureCode: "ADMIN_RECOVERY_OWNER_RESTORED",
        failureReason: "Offline recovery vytvořila nebo obnovila aktivního OWNERa.",
        emailHash: createHash("sha256").update(normalizedEmail).digest("hex"),
        userAgent: "offline-admin-recovery-cli",
        metadata: {
          adminUserId: user.id,
          source: "npm run admin:recover-owner",
        },
      },
    });

    return user;
  });
}
