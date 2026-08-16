-- Explicitní resend chain zachovává historii jednotlivých zpráv a dovoluje
-- uzavřít incident až potvrzeným doručením navazujícího resendu.
ALTER TABLE "EmailLog"
  ADD COLUMN "resendOfId" TEXT,
  ADD COLUMN "resendRootId" TEXT,
  ADD COLUMN "incidentResolvedAt" TIMESTAMP(3),
  ADD COLUMN "incidentResolvedByEmailLogId" TEXT;

CREATE INDEX "EmailLog_resendOfId_idx" ON "EmailLog"("resendOfId");
CREATE INDEX "EmailLog_resendRootId_idx" ON "EmailLog"("resendRootId");
CREATE INDEX "EmailLog_incidentResolvedAt_idx" ON "EmailLog"("incidentResolvedAt");

ALTER TABLE "EmailLog"
  ADD CONSTRAINT "EmailLog_resendOfId_fkey"
  FOREIGN KEY ("resendOfId") REFERENCES "EmailLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmailLog"
  ADD CONSTRAINT "EmailLog_resendRootId_fkey"
  FOREIGN KEY ("resendRootId") REFERENCES "EmailLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
