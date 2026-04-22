import "server-only";

import { AdminRole, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type InviteTokenDelegate = {
  create: (args: {
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    };
  }) => Promise<unknown>;
  findUnique: (args: {
    where: {
      tokenHash: string;
    };
    select?: Record<string, unknown>;
    include?: Record<string, unknown>;
  }) => Promise<unknown>;
  update: (args: {
    where: {
      id: string;
    };
    data: {
      usedAt?: Date | null;
      revokedAt?: Date | null;
    };
  }) => Promise<unknown>;
  updateMany: (args: {
    where: Record<string, unknown>;
    data: {
      usedAt?: Date | null;
      revokedAt?: Date | null;
    };
  }) => Promise<unknown>;
};

type InviteTokenRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
};

type InviteTokenWithUser = InviteTokenRecord & {
  user: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
    isActive: boolean;
  } | null;
};

function getInviteTokenDelegate(): InviteTokenDelegate | null {
  const candidate = (prisma as typeof prisma & {
    adminUserInviteToken?: InviteTokenDelegate;
  }).adminUserInviteToken;

  return candidate ?? null;
}

export async function createAdminInviteTokenRecord(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  const delegate = getInviteTokenDelegate();

  if (delegate) {
    await delegate.create({
      data,
    });
    return;
  }

  await prisma.$executeRaw`
    INSERT INTO "AdminUserInviteToken" ("id", "userId", "tokenHash", "expiresAt", "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${data.userId}, ${data.tokenHash}, ${data.expiresAt}, NOW(), NOW())
  `;
}

export async function revokeActiveAdminInviteTokens(userId: string, revokedAt: Date) {
  const delegate = getInviteTokenDelegate();

  if (delegate) {
    await delegate.updateMany({
      where: {
        userId,
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });
    return;
  }

  await prisma.$executeRaw`
    UPDATE "AdminUserInviteToken"
    SET "revokedAt" = ${revokedAt}, "updatedAt" = NOW()
    WHERE "userId" = ${userId}
      AND "usedAt" IS NULL
      AND "revokedAt" IS NULL
  `;
}

export async function revokeOtherAdminInviteTokens(
  userId: string,
  keepTokenId: string,
  revokedAt: Date,
) {
  const delegate = getInviteTokenDelegate();

  if (delegate) {
    await delegate.updateMany({
      where: {
        userId,
        id: {
          not: keepTokenId,
        },
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });
    return;
  }

  await prisma.$executeRaw`
    UPDATE "AdminUserInviteToken"
    SET "revokedAt" = ${revokedAt}, "updatedAt" = NOW()
    WHERE "userId" = ${userId}
      AND "id" <> ${keepTokenId}
      AND "usedAt" IS NULL
      AND "revokedAt" IS NULL
  `;
}

export async function markAdminInviteTokenUsed(tokenId: string, usedAt: Date) {
  const delegate = getInviteTokenDelegate();

  if (delegate) {
    await delegate.update({
      where: {
        id: tokenId,
      },
      data: {
        usedAt,
      },
    });
    return;
  }

  await prisma.$executeRaw`
    UPDATE "AdminUserInviteToken"
    SET "usedAt" = ${usedAt}, "updatedAt" = NOW()
    WHERE "id" = ${tokenId}
  `;
}

export async function findAdminInviteTokenByHash(tokenHash: string): Promise<InviteTokenRecord | null> {
  const delegate = getInviteTokenDelegate();

  if (delegate) {
    const token = (await delegate.findUnique({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
      },
    })) as InviteTokenRecord | null;

    return token;
  }

  const rows = await prisma.$queryRaw<InviteTokenRecord[]>(Prisma.sql`
    SELECT "id", "userId", "expiresAt", "usedAt", "revokedAt"
    FROM "AdminUserInviteToken"
    WHERE "tokenHash" = ${tokenHash}
    LIMIT 1
  `);

  return rows[0] ?? null;
}

export async function findAdminInviteTokenWithUserByHash(
  tokenHash: string,
): Promise<InviteTokenWithUser | null> {
  const delegate = getInviteTokenDelegate();

  if (delegate) {
    const token = (await delegate.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    })) as InviteTokenWithUser | null;

    return token;
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      expiresAt: Date;
      usedAt: Date | null;
      revokedAt: Date | null;
      user_id: string | null;
      user_name: string | null;
      user_email: string | null;
      user_role: AdminRole | null;
      user_isActive: boolean | null;
    }>
  >(Prisma.sql`
    SELECT
      token."id",
      token."userId",
      token."expiresAt",
      token."usedAt",
      token."revokedAt",
      user_record."id" AS "user_id",
      user_record."name" AS "user_name",
      user_record."email" AS "user_email",
      user_record."role" AS "user_role",
      user_record."isActive" AS "user_isActive"
    FROM "AdminUserInviteToken" token
    LEFT JOIN "AdminUser" user_record ON user_record."id" = token."userId"
    WHERE token."tokenHash" = ${tokenHash}
    LIMIT 1
  `);

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    revokedAt: row.revokedAt,
    user: row.user_id
      ? {
          id: row.user_id,
          name: row.user_name ?? "",
          email: row.user_email ?? "",
          role: row.user_role ?? AdminRole.SALON,
          isActive: Boolean(row.user_isActive),
        }
      : null,
  };
}
