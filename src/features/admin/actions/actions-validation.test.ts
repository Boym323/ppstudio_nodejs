import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

function makeFormData(values: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

test("updateClientNoteAction returns validation error for too long note", async () => {
  const { updateClientNoteAction } = await import("@/features/admin/actions/client-actions");
  const formData = makeFormData({
    area: "owner",
    clientId: "client-1",
    internalNote: "x".repeat(1001),
  });

  const result = await updateClientNoteAction({ status: "idle" }, formData);

  assert.equal(result.status, "error");
  assert.match(result.formError ?? "", /nepodařilo uložit/i);
  assert.match(result.fieldErrors?.internalNote ?? "", /příliš dlouhá/i);
});

test("createServiceAction returns validation errors for incomplete payload", async () => {
  const { createServiceAction } = await import("@/features/admin/actions/service-actions");
  const formData = makeFormData({
    area: "owner",
    categoryId: "",
    name: "",
    durationMinutes: "abc",
    priceFromCzk: "",
    homepageSortOrder: "0",
  });

  const result = await createServiceAction({ status: "idle" }, formData);

  assert.equal(result.status, "error");
  assert.match(result.formError ?? "", /doplnit nebo opravit/i);
  assert.ok(result.fieldErrors?.categoryId);
  assert.ok(result.fieldErrors?.name);
  assert.ok(result.fieldErrors?.durationMinutes);
});

test("updateServiceAction returns validation errors for invalid numbers", async () => {
  const { updateServiceAction } = await import("@/features/admin/actions/service-actions");
  const formData = makeFormData({
    area: "owner",
    serviceId: "service-1",
    categoryId: "cat-1",
    name: "A",
    durationMinutes: "4",
    priceFromCzk: "-1",
    sortOrder: "-1",
    homepageSortOrder: "-1",
  });

  const result = await updateServiceAction({ status: "idle" }, formData);

  assert.equal(result.status, "error");
  assert.match(result.formError ?? "", /doplnit nebo opravit/i);
  assert.ok(result.fieldErrors?.name);
  assert.ok(result.fieldErrors?.durationMinutes);
  assert.ok(result.fieldErrors?.priceFromCzk);
});

test("updateBookingStatusAction rejects invalid targetStatus", async () => {
  const { updateBookingStatusAction } = await import("@/features/admin/actions/booking-actions");
  const formData = makeFormData({
    area: "owner",
    bookingId: "booking-1",
    targetStatus: "INVALID",
    reason: "",
    internalNote: "",
  });

  const result = await updateBookingStatusAction({ status: "idle" }, formData);

  assert.equal(result.status, "error");
  assert.match(result.formError ?? "", /doplnit nebo opravit/i);
  assert.ok(result.fieldErrors?.targetStatus);
});

test("updateBookingPriceAction rejects non-numeric final price", async () => {
  const { updateBookingPriceAction } = await import("@/features/admin/actions/booking-actions");
  const formData = makeFormData({
    area: "owner",
    bookingId: "booking-1",
    finalPriceCzk: "abc",
    priceAdjustmentReason: "",
  });

  const result = await updateBookingPriceAction({ status: "idle" }, formData);

  assert.equal(result.status, "error");
  assert.match(result.formError ?? "", /cenu rezervace/i);
  assert.ok(result.fieldErrors?.finalPriceCzk);
});

test("createManualBookingAction rejects missing required form fields", async () => {
  const { createManualBookingAction } = await import("@/features/admin/actions/booking-actions");
  const formData = makeFormData({
    area: "owner",
    selectionMode: "manual",
    selectedClientId: "",
    serviceId: "",
    slotId: "",
    startsAt: "",
    manualDate: "",
    manualTime: "",
    fullName: "",
    email: "",
    phone: "",
    clientProfileNote: "",
    clientNote: "",
    internalNote: "",
    source: "WEB",
    bookingStatus: "PENDING",
    includeCalendarAttachment: "0",
    submitMode: "create",
  });

  const result = await createManualBookingAction({ status: "idle" }, formData);

  assert.equal(result.status, "error");
  assert.match(result.formError ?? "", /doplnit nebo opravit/i);
  assert.ok(result.fieldErrors?.serviceId);
  assert.ok(result.fieldErrors?.fullName);
});

test("updateSalonSettingsAction rejects invalid contact fields", async () => {
  const { updateSalonSettingsAction } = await import("@/features/admin/actions/settings-actions");
  const formData = makeFormData({
    salonName: "A",
    addressLine: "X",
    city: "Y",
    postalCode: "000",
    phone: "bad",
    contactEmail: "nope",
    instagramUrl: "instagram.com/no-scheme",
    voucherPdfLogoMediaId: "",
  });

  const result = await updateSalonSettingsAction({ status: "idle" }, formData);

  assert.equal(result.status, "error");
  assert.match(result.formError ?? "", /zkontrolujte/i);
  assert.ok(result.fieldErrors?.contactEmail);
  assert.ok(result.fieldErrors?.phone);
});

test("createServiceCategoryAction returns validation errors for incomplete payload", async () => {
  const { createServiceCategoryAction } = await import("@/features/admin/actions/service-category-actions");
  const formData = makeFormData({
    area: "owner",
    returnTo: "/admin/kategorie-sluzeb",
    name: "",
    description: "",
    pricingDescription: "",
    pricingLayout: "INVALID",
    pricingIconKey: "INVALID",
    sortOrder: "-1",
    pricingSortOrder: "abc",
  });

  const result = await createServiceCategoryAction({ status: "idle" }, formData);

  assert.equal(result.status, "error");
  assert.match(result.formError ?? "", /doplnit nebo opravit/i);
  assert.ok(result.fieldErrors?.name);
  assert.ok(result.fieldErrors?.pricingLayout);
  assert.ok(result.fieldErrors?.pricingIconKey);
});

test("updateServiceCategoryAction returns validation errors for malformed payload", async () => {
  const { updateServiceCategoryAction } = await import("@/features/admin/actions/service-category-actions");
  const formData = makeFormData({
    area: "salon",
    categoryId: "",
    returnTo: "/admin/provoz/kategorie-sluzeb",
    name: "A",
    description: "",
    pricingDescription: "",
    pricingLayout: "LIST",
    pricingIconKey: "DROPLET",
    sortOrder: "20000",
    pricingSortOrder: "-1",
    intent: "save",
  });

  const result = await updateServiceCategoryAction({ status: "idle" }, formData);

  assert.equal(result.status, "error");
  assert.match(result.formError ?? "", /doplnit nebo opravit/i);
  assert.ok(result.fieldErrors?.name);
  assert.ok(result.fieldErrors?.sortOrder);
  assert.ok(result.fieldErrors?.pricingSortOrder);
});
