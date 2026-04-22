CREATE TABLE "AdminUserInviteToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUserInviteToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminUserInviteToken_tokenHash_key" ON "AdminUserInviteToken"("tokenHash");
CREATE INDEX "AdminUserInviteToken_userId_expiresAt_idx" ON "AdminUserInviteToken"("userId", "expiresAt");
CREATE INDEX "AdminUserInviteToken_expiresAt_usedAt_revokedAt_idx" ON "AdminUserInviteToken"("expiresAt", "usedAt", "revokedAt");

ALTER TABLE "AdminUserInviteToken"
ADD CONSTRAINT "AdminUserInviteToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
