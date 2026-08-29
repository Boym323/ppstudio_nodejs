-- Historické terminální FAILED logy už nemají obsahovat použitelné booking/admin bearer tokeny.
-- Migrace je idempotentní: již redigovaná pole pouze nastaví na stejnou hodnotu.
UPDATE "EmailLog"
SET "payload" = (
  SELECT jsonb_object_agg(
    entry.key,
    CASE
      WHEN entry.key IN (
        'manageReservationUrl',
        'cancellationUrl',
        'approveUrl',
        'rejectUrl'
      ) THEN to_jsonb('[REDACTED]'::text)
      ELSE entry.value
    END
  )
  FROM jsonb_each("EmailLog"."payload") AS entry
)
WHERE "status" = 'FAILED'
  AND jsonb_typeof("payload") = 'object'
  AND "payload" ?| ARRAY[
    'manageReservationUrl',
    'cancellationUrl',
    'approveUrl',
    'rejectUrl'
  ];
