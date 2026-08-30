import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("DB integration runtime čte SiteSettings produkční cestou místo snapshotu nebo defaultů", async () => {
  const [{ prisma }, { ensureSiteSettings, SITE_SETTINGS_ID }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/site-settings"),
  ]);
  const original = await prisma.siteSettings.findUnique({ where: { id: SITE_SETTINGS_ID } });
  const suffix = randomUUID().slice(0, 8);
  const salonName = `DB integration studio ${suffix}`;
  const maxAdvanceDays = 37;

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: {
      salonName,
      bookingMinAdvanceHours: 5,
      bookingMaxAdvanceDays: maxAdvanceDays,
      bookingCancellationHours: 19,
      emailSenderName: salonName,
    },
    create: {
      id: SITE_SETTINGS_ID,
      salonName,
      addressLine: "Integrační 1",
      city: "Zlín",
      postalCode: "760 01",
      phone: "+420 732 856 036",
      contactEmail: "integration@example.com",
      instagramUrl: null,
      bookingMinAdvanceHours: 5,
      bookingMaxAdvanceDays: maxAdvanceDays,
      bookingCancellationHours: 19,
      autoLunchEnabled: true,
      notificationAdminEmail: "owner@example.com",
      emailSenderName: salonName,
      emailSenderEmail: "integration@example.com",
      emailFooterText: null,
      voucherPdfLogoMediaId: null,
    },
  });

  try {
    const {
      getBookingPolicySettings,
      getEmailBrandingSettings,
      getPublicSalonProfile,
      getSiteSettings,
      getSiteSettingsReadResult,
      hasCurrentBookingPolicySettings,
    } = await import("@/lib/site-settings");
    const [result, siteSettings, bookingPolicy, publicProfile, emailBranding, hasCurrentPolicy] = await Promise.all([
      getSiteSettingsReadResult(),
      getSiteSettings(),
      getBookingPolicySettings(),
      getPublicSalonProfile(),
      getEmailBrandingSettings(),
      hasCurrentBookingPolicySettings(),
    ]);

    assert.equal(result.source, "database");
    assert.equal(result.settings.salonName, salonName);
    assert.equal(siteSettings.salonName, salonName);
    assert.equal(bookingPolicy.maxAdvanceDays, maxAdvanceDays);
    assert.equal(bookingPolicy.minAdvanceHours, 5);
    assert.equal(bookingPolicy.cancellationHours, 19);
    assert.equal(publicProfile.name, salonName);
    assert.equal(emailBranding.senderName, salonName);
    assert.equal(hasCurrentPolicy, true);
  } finally {
    if (original) {
      await prisma.siteSettings.update({ where: { id: SITE_SETTINGS_ID }, data: original });
    } else {
      // Ostatní DB integrační testy mohou singleton používat souběžně nebo
      // bezprostředně po tomto testu. Nenechávej proto sdílenou tabulku prázdnou.
      await ensureSiteSettings();
    }
  }
});
