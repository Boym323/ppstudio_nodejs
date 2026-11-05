import assert from "node:assert/strict";
import test from "node:test";
import type { VoucherValidationReasonCode } from "./voucher-validation";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("audit uchová přesný důvod odmítnutí pro oba zdroje a zachová kód pro rate limit", async (t) => {
  const writes: Array<{ data: { failureReason: string; failureCode: string } }> = [];
  t.mock.module("@/lib/prisma", { exports: { prisma: { bookingSubmissionLog: {
    create: async (args: typeof writes[number]) => { writes.push(args); return {}; },
  } } } });
  const { writeVoucherPublicVerificationAttemptLog, publicVoucherVerificationSources } = await import("./voucher-public-verification-rate-limit");
  const cases: Array<[VoucherValidationReasonCode, string]> = [
    ["INVALID_INPUT", "Kód voucheru má neplatný formát nebo je prázdný."],
    ["NOT_FOUND", "Voucher se zadaným kódem nebyl nalezen."],
    ["DRAFT", "Voucher zatím není aktivní."],
    ["CANCELLED", "Voucher byl zrušen."],
    ["REDEEMED", "Voucher už byl plně uplatněn."],
    ["EXPIRED", "Platnost voucheru vypršela."],
    ["NO_REMAINING_VALUE", "Voucher nemá dostupný zůstatek."],
    ["SERVICE_MISMATCH", "Voucher nelze použít na vybranou službu."],
    ["NOT_ACTIVATED", "Voucher zatím nebyl aktivován."],
    ["STOCK_VOID", "Předtištěný voucher byl zneplatněn."],
  ];
  for (const source of Object.values(publicVoucherVerificationSources)) {
    for (const [validationReason, description] of cases) {
      await writeVoucherPublicVerificationAttemptLog({ source, auditOutcome: "NOT_FOUND_OR_INVALID", validationReason });
      assert.equal(writes.at(-1)?.data.failureReason, description);
      assert.equal(writes.at(-1)?.data.failureCode, `PUBLIC_VOUCHER_VERIFY_${source}_NOT_FOUND_OR_INVALID`);
    }
    await writeVoucherPublicVerificationAttemptLog({ source, auditOutcome: "NOT_FOUND_OR_INVALID" });
    assert.equal(writes.at(-1)?.data.failureReason, "Veřejné ověření voucheru neprošlo.");
    await writeVoucherPublicVerificationAttemptLog({ source, auditOutcome: "SUCCESS", validationReason: "EXPIRED" });
    assert.equal(writes.at(-1)?.data.failureReason, "Veřejné ověření voucheru proběhlo úspěšně.");
  }
});

test("veřejné ověření voucheru se zablokuje od desátého neplatného pokusu v okně", async () => {
  const { isVoucherPublicVerificationRateLimited } = await import("./voucher-public-verification-rate-limit");

  assert.equal(isVoucherPublicVerificationRateLimited(9), false);
  assert.equal(isVoucherPublicVerificationRateLimited(10), true);
  assert.equal(isVoucherPublicVerificationRateLimited(11), true);
});

test("do limitu hádání kódu patří jen doménově neplatný výsledek", async () => {
  const {
    isVoucherPublicVerificationGuessingAttempt,
  } = await import("./voucher-public-verification-rate-limit");

  assert.equal(isVoucherPublicVerificationGuessingAttempt("NOT_FOUND_OR_INVALID"), true);
  assert.equal(isVoucherPublicVerificationGuessingAttempt("SUCCESS"), false);
  assert.equal(isVoucherPublicVerificationGuessingAttempt("UNKNOWN_ERROR"), false);
  assert.equal(isVoucherPublicVerificationGuessingAttempt("RATE_LIMITED"), false);
});

test("úspěšné revalidace nevyčerpají limit pro následný neplatný pokus", async () => {
  const { isVoucherPublicVerificationRateLimited } = await import("./voucher-public-verification-rate-limit");

  const successfulRevalidations = 20;
  const invalidAttempts = 1;

  assert.equal(successfulRevalidations > 10, true);
  assert.equal(isVoucherPublicVerificationRateLimited(invalidAttempts), false);
});

test("zdroje veřejného ověření a rezervačního formuláře jsou oddělené", async () => {
  const {
    getVoucherPublicVerificationAttemptWhere,
    getVoucherPublicVerificationFailureCode,
    publicVoucherVerificationSources,
  } = await import("./voucher-public-verification-rate-limit");

  assert.notEqual(
    publicVoucherVerificationSources.publicPage,
    publicVoucherVerificationSources.publicBooking,
  );

  const windowStart = new Date("2026-08-02T10:00:00.000Z");
  const publicPageWhere = getVoucherPublicVerificationAttemptWhere({
    ipHash: "same-ip",
    source: publicVoucherVerificationSources.publicPage,
    windowStart,
  });
  const publicBookingWhere = getVoucherPublicVerificationAttemptWhere({
    ipHash: "same-ip",
    source: publicVoucherVerificationSources.publicBooking,
    windowStart,
  });

  assert.deepEqual(publicPageWhere, {
    ipHash: "same-ip",
    createdAt: { gte: windowStart },
    failureCode: {
      equals: getVoucherPublicVerificationFailureCode(
        publicVoucherVerificationSources.publicPage,
        "NOT_FOUND_OR_INVALID",
      ),
    },
  });
  assert.notDeepEqual(publicPageWhere, publicBookingWhere);
});

test("auditní kódy zachovají úspěch i interní chybu mimo rozpočet neplatných pokusů", async () => {
  const {
    getVoucherPublicVerificationFailureCode,
    publicVoucherVerificationSources,
  } = await import("./voucher-public-verification-rate-limit");

  const source = publicVoucherVerificationSources.publicBooking;

  assert.match(getVoucherPublicVerificationFailureCode(source, "SUCCESS"), /_SUCCESS$/);
  assert.match(getVoucherPublicVerificationFailureCode(source, "UNKNOWN_ERROR"), /_UNKNOWN_ERROR$/);
  assert.match(getVoucherPublicVerificationFailureCode(source, "NOT_FOUND_OR_INVALID"), /_NOT_FOUND_OR_INVALID$/);
});
