import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { BookingStatus, BookingSubmissionOutcome } from "@prisma/client";

import {
  buildBookingHistoryWhere,
  buildAvailabilityAuditWhere,
  buildEmailLogWhere,
  buildVoucherWhere,
  getBookingSubmissionPresentation,
  getBookingHistoryPresentation,
  getAdminLogPageMeta,
  getAdminLogCandidatePlan,
  getEmailDeliveryFailureWhere,
  getEmailDetailFinalStatus,
  getEmailHealthState,
  getUnresolvedEmailDeliveryFailureWhere,
  getUnresolvedEmailDeliveryIncidentRootWhere,
  getEmailLogSeverity,
  isCriticalBookingSubmission,
  normalizeAdminLogView,
  sortAndPageAdminLogItems,
  withBookingSubmissionSeverity,
  withEmailLogScope,
  type AdminLogItem,
} from "./admin-data";

function item(id: string, occurredAt: string): AdminLogItem {
  return { id, occurredAt, category: "event", severity: "info", title: id, description: null, actorLabel: null, entityLabel: null, entityHref: null, sourceType: "booking", sourceId: id, primaryAction: null };
}

test("neplatný, skrytý a technický SALON view se normalizují na events", () => {
  assert.equal(normalizeAdminLogView("unknown", "owner"), "events");
  assert.equal(normalizeAdminLogView("automation", "owner"), "events");
  assert.equal(normalizeAdminLogView("automation", "salon"), "events");
  assert.equal(normalizeAdminLogView("system", "salon"), "events");
});

test("systémová závažnost omezuje dotaz už před stránkováním", () => {
  const errorWhere = withBookingSubmissionSeverity({}, "error");
  const warningWhere = withBookingSubmissionSeverity({}, "warning");
  assert.match(JSON.stringify(errorWhere), /UNKNOWN_ERROR/);
  assert.match(JSON.stringify(errorWhere), /ADMIN_LOGIN_/);
  assert.deepEqual(warningWhere, { AND: [{}, { id: "__no_match__" }] });
});

test("BookingSubmissionLog rozlišuje booking, login, aktivaci, voucher a recovery", () => {
  assert.deepEqual(
    getBookingSubmissionPresentation({ outcome: BookingSubmissionOutcome.FAILED, failureCode: "ADMIN_LOGIN_INVALID_CREDENTIALS" }),
    { title: "Přihlášení administrátora", severity: "info", entityFallback: "Administrace", needsAttention: false },
  );
  assert.equal(getBookingSubmissionPresentation({ outcome: BookingSubmissionOutcome.SUCCESS, failureCode: "ADMIN_INVITE_ACTIVATION_SUCCESS" }).title, "Aktivace přístupu");
  assert.equal(getBookingSubmissionPresentation({ outcome: BookingSubmissionOutcome.FAILED, failureCode: "PUBLIC_VOUCHER_VERIFY_PUBLIC_PAGE_NOT_FOUND_OR_INVALID" }).title, "Veřejné ověření voucheru");
  assert.equal(getBookingSubmissionPresentation({ outcome: BookingSubmissionOutcome.SUCCESS, failureCode: "ADMIN_RECOVERY_OWNER_RESTORED" }).title, "Obnova administrátora");
  assert.equal(getBookingSubmissionPresentation({ outcome: BookingSubmissionOutcome.FAILED, failureCode: "VALIDATION_ERROR" }).title, "Odeslání rezervace selhalo");
});

test("historie rezervace rozlišuje změny stavu od provozního auditu", () => {
  assert.deepEqual(
    getBookingHistoryPresentation({
      status: BookingStatus.CONFIRMED,
      reason: "Potvrzeno administrátorkou",
      metadata: { source: "admin-booking-detail-v2", fromStatus: "PENDING", toStatus: "CONFIRMED" },
    }),
    { title: "Rezervace potvrzena", severity: "success", description: "Potvrzeno administrátorkou" },
  );
  assert.deepEqual(
    getBookingHistoryPresentation({
      status: BookingStatus.CONFIRMED,
      reason: "Individuální cena upravena",
      metadata: { source: "admin-booking-price-update-v1" },
    }),
    { title: "Cena rezervace upravena", severity: "info", description: "Individuální cena upravena" },
  );
  for (const [source, reason, title] of [
    ["admin-booking-note-v1", "Interní poznámka upravena", "Interní poznámka upravena"],
    ["admin-client-contact-update-v1", "Kontakt klientky upraven", "Kontakt klientky upraven"],
    ["admin-booking-payment-update-v1", "Platba upravena", "Platba upravena"],
  ] as const) {
    const presentation = getBookingHistoryPresentation({ status: BookingStatus.CONFIRMED, reason, metadata: { source } });
    assert.equal(presentation.title, title);
    assert.equal(presentation.severity, "info");
  }
});

test("historie rezervace zachovává prezentaci terminalních změn stavu", () => {
  for (const [status, title, severity] of [
    [BookingStatus.CANCELLED, "Rezervace zrušena", "info"],
    [BookingStatus.COMPLETED, "Rezervace dokončena", "success"],
    [BookingStatus.NO_SHOW, "Klientka nedorazila", "warning"],
  ] as const) {
    const presentation = getBookingHistoryPresentation({ status, reason: null, metadata: { source: "admin-booking-detail-v2" } });
    assert.equal(presentation.title, title);
    assert.equal(presentation.severity, severity);
  }
});

test("Pozornost odmítá běžný šum a přijímá jen skutečné systémové chyby", () => {
  for (const code of ["ADMIN_LOGIN_INVALID_CREDENTIALS", "ADMIN_LOGIN_RATE_LIMITED", "VALIDATION_ERROR", "RATE_LIMITED", "PUBLIC_VOUCHER_VERIFY_PUBLIC_PAGE_NOT_FOUND_OR_INVALID"]) {
    assert.equal(isCriticalBookingSubmission(code), false, code);
  }
  for (const code of ["TEMPORARY_FAILURE", "SCHEMA_MISMATCH", "UNEXPECTED_ERROR", "PUBLIC_VOUCHER_VERIFY_PUBLIC_PAGE_UNKNOWN_ERROR"]) {
    assert.equal(isCriticalBookingSubmission(code), true, code);
  }
});

test("query builder EmailLog hledá před take v dostupných polích", () => {
  const where = buildEmailLogWhere("jana");
  assert.deepEqual(where.OR?.[0], { recipientEmail: { contains: "jana", mode: "insensitive" } });
  assert.deepEqual(where.OR?.[1], { subject: { contains: "jana", mode: "insensitive" } });
});

test("Pozornost zahrnuje transportní i provider delivery failures bez duplicit", () => {
  const staleBefore = new Date("2026-07-23T10:00:00.000Z");
  const where = withEmailLogScope({}, "attention", "all", staleBefore);
  const attention = (where.AND as object[])[1];
  assert.deepEqual(attention, { OR: [
    getUnresolvedEmailDeliveryFailureWhere(),
    { OR: [
      { trackingComplainedAt: { not: null } },
      { trackingLastEvent: "email.delivery_delayed", trackingDeliveredAt: null, trackingOpenedAt: null, trackingClickedAt: null },
    ] },
    { status: "PENDING", attemptCount: { gt: 0 }, processingStartedAt: null },
    { status: "PENDING", processingStartedAt: { lt: staleBefore } },
  ] });
});

test("complaint zůstává warningem v Pozornosti mimo počet delivery failures", () => {
  const staleBefore = new Date("2026-07-23T10:00:00.000Z");
  const attention = withEmailLogScope({}, "attention", "all", staleBefore);

  assert.deepEqual(getEmailDeliveryFailureWhere().OR, [
    { status: "FAILED" },
    { trackingBouncedAt: { not: null } },
    { trackingFailedAt: { not: null } },
    { trackingSuppressedAt: { not: null } },
  ]);
  assert.match(JSON.stringify(attention), /trackingComplainedAt/);
  const complaintStatus = getEmailDetailFinalStatus({
    status: "SENT",
    sentAt: new Date("2026-07-23T10:00:00.000Z"),
    processingStartedAt: null,
    attemptCount: 0,
    nextAttemptAt: null,
    updatedAt: new Date("2026-07-23T10:02:00.000Z"),
    trackingLastEvent: "email.complained",
    trackingClickedAt: null,
    trackingOpenedAt: null,
    trackingDeliveredAt: new Date("2026-07-23T10:00:00.000Z"),
    trackingBouncedAt: null,
    trackingComplainedAt: new Date("2026-07-23T10:02:00.000Z"),
    trackingFailedAt: null,
    trackingSuppressedAt: null,
  });

  assert.equal(complaintStatus.label, "Nahlášeno jako spam");
  assert.doesNotMatch(complaintStatus.label, /Nedoručeno/);
});

test("aktivní delivery failure vyžaduje neuzavřený explicitní resend chain", () => {
  assert.deepEqual(getUnresolvedEmailDeliveryFailureWhere(), {
    AND: [
      getEmailDeliveryFailureWhere(),
      { OR: [
        { resendRootId: null, incidentResolvedAt: null },
        { resendRoot: { is: { incidentResolvedAt: null } } },
      ] },
    ],
  });
});

test("aktivní delivery incidenty se čtou pouze přes neuzavřené stabilní rooty", () => {
  assert.deepEqual(getUnresolvedEmailDeliveryIncidentRootWhere(), {
    AND: [
      { resendRootId: null, incidentResolvedAt: null },
      { OR: [
        getEmailDeliveryFailureWhere(),
        { incidentResends: { some: getEmailDeliveryFailureWhere() } },
      ] },
    ],
  });
});

test("health e-mailů popisuje transportní i následné delivery incidenty obecně", () => {
  const health = getEmailHealthState({
    pending: 0,
    retrying: 0,
    processing: 0,
    failed: 1,
    latestError: null,
    lastSentLabel: "16. 8. 2026 10:00",
  });

  assert.equal(health.title, "Problém s e-maily");
  assert.equal(health.helper, "Některé zprávy mají problém s odesláním nebo následným doručením.");
  assert.match(health.summary, /Aktivní incidenty: 1/);
});

test("read-model e-mailů pojmenovává agregovaný počet jako aktivní incidenty a SENT jako předání providerovi", async () => {
  const source = await readFile(new URL("./admin-data.ts", import.meta.url), "utf8");

  assert.ok(source.includes('label: "Aktivní e-mailové incidenty"'));
  assert.ok(source.includes('detail: "Nevyřešené problémy s odesláním nebo doručením."'));
  assert.ok(source.includes('label: "Aktivní incidenty"'));
  assert.ok(source.includes('detail: "Auditní součet zpráv úspěšně předaných e-mailovému providerovi."'));
  assert.equal(source.includes("Auditní součet všech úspěšně doručených emailů."), false);
});

test("severity e-mailu dává delivery state přednost před SENT", () => {
  const base = {
    trackingLastEvent: null,
    trackingClickedAt: null,
    trackingOpenedAt: null,
    trackingDeliveredAt: null,
    trackingBouncedAt: null,
    trackingComplainedAt: null,
    trackingFailedAt: null,
    trackingSuppressedAt: null,
    processingStartedAt: null,
    attemptCount: 1,
    staleBefore: new Date("2026-07-23T10:00:00.000Z"),
  };

  assert.equal(getEmailLogSeverity({ ...base, status: "SENT" }), "success");
  assert.equal(getEmailLogSeverity({ ...base, status: "SENT", trackingDeliveredAt: new Date() }), "success");
  assert.equal(getEmailLogSeverity({ ...base, status: "SENT", trackingBouncedAt: new Date() }), "error");
  assert.equal(getEmailLogSeverity({ ...base, status: "FAILED" }), "error");
  assert.equal(getEmailLogSeverity({ ...base, status: "SENT", trackingLastEvent: "email.delivery_delayed" }), "warning");
});

test("query builder booking historie hledá v důvodu, poznámce a rezervaci", () => {
  const where = buildBookingHistoryWhere("abc");
  assert.deepEqual(where.OR?.[0], { reason: { contains: "abc", mode: "insensitive" } });
  assert.deepEqual(where.OR?.[1], { note: { contains: "abc", mode: "insensitive" } });
});

test("query builder auditu dostupnosti hledá den, zdroj, operaci i autora", () => {
  const where = buildAvailabilityAuditWhere("Pavlína");
  assert.equal(where.OR?.length, 4);
  assert.deepEqual(where.OR?.[3], { actorUser: { is: { name: { contains: "Pavlína", mode: "insensitive" } } } });
});

test("query builder voucheru hledá kód, jména a e-mail", () => {
  const where = buildVoucherWhere("dar");
  assert.equal(where.OR?.length, 4);
  assert.deepEqual(where.OR?.[2], { purchaserEmail: { contains: "dar", mode: "insensitive" } });
});

test("globální pořadí a druhá stránka fungují přes více zdrojů", () => {
  const items = Array.from({ length: 120 }, (_, index) => item(index % 2 ? `voucher:${index}` : `booking:${index}`, new Date(Date.UTC(2026, 0, 1, 0, 0, 120 - index)).toISOString()));
  const first = sortAndPageAdminLogItems(items, 1);
  const second = sortAndPageAdminLogItems(items, 2);
  assert.equal(first.length, 50);
  assert.equal(second.length, 50);
  assert.equal(first.at(-1)!.occurredAt > second[0]!.occurredAt, true);
  assert.equal(new Set([...first, ...second].map((entry) => entry.id)).size, 100);
});

test("shodný čas používá stabilní source-prefixed ID", () => {
  const time = "2026-07-23T10:00:00.000Z";
  assert.deepEqual(sortAndPageAdminLogItems([item("booking:a", time), item("voucher:z", time), item("email:m", time)], 1).map((entry) => entry.id), ["voucher:z", "email:m", "booking:a"]);
});

test("přesný total určuje pageCount, rozsah i normalizaci stránky", () => {
  assert.deepEqual(getAdminLogPageMeta(137, 2), { page: 2, pageCount: 3, rangeStart: 51, rangeEnd: 100 });
  assert.deepEqual(getAdminLogPageMeta(137, 99), { page: 3, pageCount: 3, rangeStart: 101, rangeEnd: 137 });
  assert.equal(getAdminLogPageMeta(137, Number.NaN).page, 1);
});

test("extrémní stránka se clampne před výpočtem kandidátního take", () => {
  assert.deepEqual(getAdminLogCandidatePlan(137, 100_000), {
    page: 3,
    pageCount: 3,
    rangeStart: 101,
    rangeEnd: 137,
    offset: 100,
    take: 151,
  });
});

test("findMany a count sdílejí stejné where proměnné", async () => {
  const source = await readFile(new URL("./admin-data.ts", import.meta.url), "utf8");
  for (const whereName of ["emailWhere", "bookingHistoryWhere", "rescheduleWhere", "voucherWhere", "redemptionWhere", "voucherChangeWhere", "serviceChangeWhere", "siteSettingsChangeWhere", "availabilityWhere", "adminUserAuditWhere", "submissionWhere"]) {
    assert.ok(source.includes(`findMany({ where: ${whereName}`));
    assert.ok(source.includes(`count({ where: ${whereName}`));
  }
  assert.ok(source.includes("getAdminLogCandidatePlan(total, requestedPage)"));
  assert.equal(source.includes("requestedOffset + adminLogPageSize"), false);
  assert.ok(source.includes('const attentionHealthActive = safeView === "attention"'));
  assert.ok(source.includes("attentionHealthActive || ownerQueueHealthActive ? prisma.emailLog.count"));
});

test("stará email-log route přesměruje na pohled emails", async () => {
  const source = await readFile(new URL("../../../app/(admin)/admin/email-logy/page.tsx", import.meta.url), "utf8");
  assert.ok(source.includes('redirect("/admin/logy?view=emails")'));
});

test("mobilní drawer zachová view a formuláře neposílají page", async () => {
  const source = await readFile(new URL("../components/admin-logs-page.tsx", import.meta.url), "utf8");
  assert.ok(source.includes('name="view" value={data.view}'));
  assert.equal(source.includes('name="page"'), false);
  assert.ok(source.includes('value="availability">Dostupnost'));
  assert.ok(source.includes("E-mailová fronta"));
});

test("veřejný booking rate-limit ignoruje všechny známé nebookingové prefixy", async () => {
  const source = await readFile(new URL("../../booking/actions/create-public-booking.ts", import.meta.url), "utf8");
  for (const prefix of ["ADMIN_LOGIN_", "ADMIN_INVITE_ACTIVATION_", "ADMIN_RECOVERY_", "PUBLIC_VOUCHER_VERIFY_"]) {
    assert.ok(source.includes(`"${prefix}"`), prefix);
  }
});
