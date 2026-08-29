import assert from "node:assert/strict";
import test from "node:test";

test("scrubSensitiveEmailPayload rediguje pouze známá bearer pole a zachová ostatní payload", async () => {
  const { REDACTED_EMAIL_PAYLOAD_VALUE, scrubSensitiveEmailPayload } = await import("./payload-security");
  const payload = {
    bookingId: "booking-1",
    clientName: "Klientka",
    manageReservationUrl: "https://example.com/rezervace/sprava/raw-manage-token",
    cancellationUrl: "https://example.com/rezervace/storno/raw-cancel-token",
    approveUrl: "https://example.com/rezervace/akce/approve/raw-approve-token",
    rejectUrl: "https://example.com/rezervace/akce/reject/raw-reject-token",
    nested: { value: "zachovat" },
  };

  assert.deepEqual(scrubSensitiveEmailPayload(payload), {
    bookingId: "booking-1",
    clientName: "Klientka",
    manageReservationUrl: REDACTED_EMAIL_PAYLOAD_VALUE,
    cancellationUrl: REDACTED_EMAIL_PAYLOAD_VALUE,
    approveUrl: REDACTED_EMAIL_PAYLOAD_VALUE,
    rejectUrl: REDACTED_EMAIL_PAYLOAD_VALUE,
    nested: { value: "zachovat" },
  });
  assert.deepEqual(payload, {
    bookingId: "booking-1",
    clientName: "Klientka",
    manageReservationUrl: "https://example.com/rezervace/sprava/raw-manage-token",
    cancellationUrl: "https://example.com/rezervace/storno/raw-cancel-token",
    approveUrl: "https://example.com/rezervace/akce/approve/raw-approve-token",
    rejectUrl: "https://example.com/rezervace/akce/reject/raw-reject-token",
    nested: { value: "zachovat" },
  });
});

test("scrubSensitiveEmailPayload zachová necitlivý payload beze změny", async () => {
  const { scrubSensitiveEmailPayload } = await import("./payload-security");
  const payload = { bookingId: "booking-1", clientName: "Klientka" };

  assert.deepEqual(scrubSensitiveEmailPayload(payload), payload);
});
