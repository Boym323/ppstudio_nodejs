import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("getSiteSettingsReadResult returns the snapshot after an explicit database failure", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "ppstudio-site-settings-"));
  const snapshotPath = path.join(directory, "site-settings-snapshot.json");

  process.env.NEXT_PUBLIC_APP_NAME = "PP Studio";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
  process.env.ADMIN_SESSION_SECRET = "test-secret-value-with-at-least-32-chars";
  process.env.ADMIN_OWNER_EMAIL = "owner@example.com";
  process.env.EMAIL_DELIVERY_MODE = "log";
  process.env.SITE_SETTINGS_SNAPSHOT_PATH = snapshotPath;

  await writeFile(snapshotPath, JSON.stringify({
    id: "site-settings",
    salonName: "Snapshot Studio",
    addressLine: "Snapshot 1",
    city: "Zlín",
    postalCode: "760 01",
    phone: "+420 732 856 036",
    contactEmail: "info@example.com",
    instagramUrl: null,
    bookingMinAdvanceHours: 2,
    bookingMaxAdvanceDays: 90,
    bookingCancellationHours: 24,
    autoLunchEnabled: true,
    notificationAdminEmail: "owner@example.com",
    emailSenderName: "Snapshot Studio",
    emailSenderEmail: "info@example.com",
    emailFooterText: null,
    voucherPdfLogoMediaId: null,
    updatedByUserId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }));

  try {
    const { getSiteSettingsReadResult } = await import("@/lib/site-settings");
    const databaseError = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
      code: "ECONNREFUSED",
    });
    let reportedError: unknown;
    const result = await getSiteSettingsReadResult({
      readFromDb: async () => { throw databaseError; },
      onDatabaseError: (error) => { reportedError = error; },
    });

    assert.equal(result.source, "snapshot");
    assert.equal(result.settings.salonName, "Snapshot Studio");
    assert.equal(reportedError, databaseError);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("běžný unit-test runtime nečte SiteSettings z databáze", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { getSiteSettingsReadResult } = await import("@/lib/site-settings");
  const originalDbIntegrationFlag = process.env.RUN_DB_INTEGRATION_TESTS;
  let dbReadCount = 0;
  const mutableSiteSettings = prisma.siteSettings as unknown as {
    findUnique: (...args: unknown[]) => unknown;
  };
  const originalFindUnique = mutableSiteSettings.findUnique;

  process.env.RUN_DB_INTEGRATION_TESTS = undefined;
  mutableSiteSettings.findUnique = async () => {
    dbReadCount += 1;
    throw new Error("Unit test nesmí volat Prisma SiteSettings.");
  };

  try {
    await getSiteSettingsReadResult();
    assert.equal(dbReadCount, 0);
  } finally {
    mutableSiteSettings.findUnique = originalFindUnique;
    process.env.RUN_DB_INTEGRATION_TESTS = originalDbIntegrationFlag;
  }
});
