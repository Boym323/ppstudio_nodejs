-- Historické SENT logy už nemají obsahovat použitelný booking/admin bearer token.
-- PENDING a FAILED záznamy zůstávají nedotčené kvůli outbox retry workflow.
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
WHERE "status" = 'SENT'
  AND jsonb_typeof("payload") = 'object'
  AND "payload" ?| ARRAY[
    'manageReservationUrl',
    'cancellationUrl',
    'approveUrl',
    'rejectUrl'
  ];
