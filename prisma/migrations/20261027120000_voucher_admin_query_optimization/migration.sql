-- CreateIndex
CREATE INDEX "Voucher_createdAt_code_idx" ON "Voucher"("createdAt" DESC, "code" ASC);
