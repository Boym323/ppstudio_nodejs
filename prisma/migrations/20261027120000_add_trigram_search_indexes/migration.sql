-- Enable trigram operators for efficient substring searches.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- The admin client search uses case-insensitive substring matching on these fields.
CREATE INDEX "Client_fullName_trgm_idx"
ON "Client" USING GIN ("fullName" gin_trgm_ops);

CREATE INDEX "Client_email_trgm_idx"
ON "Client" USING GIN ("email" gin_trgm_ops);

CREATE INDEX "Client_phone_trgm_idx"
ON "Client" USING GIN ("phone" gin_trgm_ops);

-- The voucher list searches all of these snapshot and contact fields with ILIKE.
CREATE INDEX "Voucher_code_trgm_idx"
ON "Voucher" USING GIN ("code" gin_trgm_ops);

CREATE INDEX "Voucher_purchaserName_trgm_idx"
ON "Voucher" USING GIN ("purchaserName" gin_trgm_ops);

CREATE INDEX "Voucher_purchaserEmail_trgm_idx"
ON "Voucher" USING GIN ("purchaserEmail" gin_trgm_ops);

CREATE INDEX "Voucher_recipientName_trgm_idx"
ON "Voucher" USING GIN ("recipientName" gin_trgm_ops);

CREATE INDEX "Voucher_serviceNameSnapshot_trgm_idx"
ON "Voucher" USING GIN ("serviceNameSnapshot" gin_trgm_ops);
