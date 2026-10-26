import { BookingStatus, BookingSubmissionOutcome, EmailLogStatus, EmailLogType, Prisma } from "@/generated/prisma/client";

import type { AdminArea } from "@/config/navigation";
import { getDayBounds, isValidDateKey } from "@/features/admin/lib/admin-slots/time";
import { getEmailDeliveryFailureWhere, getUnresolvedEmailDeliveryFailureWhere } from "@/lib/email/incidents";

import { formatTime } from "./email-log-presentations";
import {
  getBookingHistorySource,
} from "./email-log-vouchers";
import type { AdminLogSeverity, AdminLogView } from "./email-log-types";

const bookingHistoryAuditSourcePresentation = {
  "admin-booking-price-update-v1": { title: "Cena rezervace upravena", severity: "info" },
  "admin-booking-note-v1": { title: "Interní poznámka upravena", severity: "info" },
  "admin-client-contact-update-v1": { title: "Kontakt klientky upraven", severity: "info" },
  "admin-booking-service-change-v1": { title: "Služba rezervace změněna", severity: "info" },
  "admin-booking-payment-create-v1": { title: "Platba zaznamenána", severity: "info" },
  "admin-booking-payment-update-v1": { title: "Platba upravena", severity: "info" },
  "admin-booking-payment-void-v1": { title: "Platba stornována", severity: "info" },
  "admin-booking-complete-flow-v1": { title: "Platba zaznamenána", severity: "info" },
} as const satisfies Record<string, { title: string; severity: AdminLogSeverity }>;

const bookingHistoryReasonPresentation = {
  "public-booking-request-v1": { title: "Rezervace vytvořena", severity: "info" },
  "admin-manual-booking-v1": { title: "Rezervace vytvořena", severity: "info" },
  "owner-email-approve-v1": { title: "Rezervace potvrzena", severity: "success" },
  "owner-email-reject-v1": { title: "Rezervace zrušena", severity: "info" },
  "public-cancellation-flow-v1": { title: "Rezervace zrušena", severity: "info" },
  "Voucher uplatněn při dokončení návštěvy": { title: "Voucher uplatněn při dokončení návštěvy", severity: "info" },
} as const satisfies Record<string, { title: string; severity: AdminLogSeverity }>;

const bookingHistoryOperationalSources = Object.keys(bookingHistoryAuditSourcePresentation);

function bookingHistoryLabel(status: BookingStatus) {
  switch (status) {
    case BookingStatus.PENDING: return "Rezervace vytvořena";
    case BookingStatus.CONFIRMED: return "Rezervace potvrzena";
    case BookingStatus.CANCELLED: return "Rezervace zrušena";
    case BookingStatus.COMPLETED: return "Rezervace dokončena";
    case BookingStatus.NO_SHOW: return "Klientka nedorazila";
  }
}

function bookingHistorySeverity(status: BookingStatus): AdminLogSeverity {
  if (status === BookingStatus.NO_SHOW) return "warning";
  if (status === BookingStatus.COMPLETED || status === BookingStatus.CONFIRMED) return "success";
  return "info";
}

function bookingHistoryReasonLabel(reason: string | null) {
  const labels: Record<string, string> = {
    "public-booking-request-v1": "Rezervace odeslána z online formuláře",
    "owner-email-approve-v1": "Rezervace potvrzena z e-mailu",
    "owner-email-reject-v1": "Rezervace zamítnuta z e-mailu",
    "public-cancellation-flow-v1": "Rezervace zrušena klientkou online",
    "admin-manual-booking-v1": "Rezervace vytvořena ručně v administraci",
  };
  return reason ? labels[reason] ?? reason : null;
}

export function getBookingHistoryPresentation(entry: {
  status: BookingStatus;
  reason: string | null;
  metadata: Prisma.JsonValue | null;
}) {
  const reasonPresentation = entry.reason ? bookingHistoryReasonPresentation[entry.reason as keyof typeof bookingHistoryReasonPresentation] : null;
  if (reasonPresentation) {
    return { ...reasonPresentation, description: bookingHistoryReasonLabel(entry.reason) };
  }

  const source = getBookingHistorySource(entry.metadata);
  const sourcePresentation = source ? bookingHistoryAuditSourcePresentation[source as keyof typeof bookingHistoryAuditSourcePresentation] : null;
  if (sourcePresentation) {
    return { ...sourcePresentation, description: bookingHistoryReasonLabel(entry.reason) };
  }

  return {
    title: bookingHistoryLabel(entry.status),
    severity: bookingHistorySeverity(entry.status),
    description: bookingHistoryReasonLabel(entry.reason),
  };
}

export const adminSubmissionPrefixes = ["ADMIN_LOGIN_", "ADMIN_INVITE_ACTIVATION_", "ADMIN_RECOVERY_"] as const;
export const publicVoucherSubmissionPrefix = "PUBLIC_VOUCHER_VERIFY_";
const expectedBookingFailureCodes = [
  "RATE_LIMITED",
  "VALIDATION_ERROR",
  "SERVICE_UNAVAILABLE",
  "SLOT_UNAVAILABLE",
  "SLOT_NOT_ALLOWED",
  "SLOT_TOO_SHORT",
  "SLOT_ALREADY_BOOKED_BY_CLIENT",
  "VOUCHER_INVALID",
  "BOOKING_CONFLICT",
] as const;
const criticalBookingFailureCodes = ["TEMPORARY_FAILURE", "SCHEMA_MISMATCH", "UNEXPECTED_ERROR"] as const;

export function isCriticalBookingSubmission(failureCode: string | null) {
  return criticalBookingFailureCodes.some((code) => code === failureCode)
    || (failureCode?.startsWith(publicVoucherSubmissionPrefix) === true && failureCode.endsWith("_UNKNOWN_ERROR"));
}

export function getBookingSubmissionPresentation(entry: {
  outcome: BookingSubmissionOutcome;
  failureCode: string | null;
}) {
  const { failureCode, outcome } = entry;
  if (failureCode?.startsWith("ADMIN_LOGIN_")) {
    return { title: "Přihlášení administrátora", severity: "info" as const, entityFallback: "Administrace", needsAttention: false };
  }
  if (failureCode?.startsWith("ADMIN_INVITE_ACTIVATION_")) {
    return { title: "Aktivace přístupu", severity: "info" as const, entityFallback: "Administrátorský přístup", needsAttention: false };
  }
  if (failureCode?.startsWith("ADMIN_RECOVERY_")) {
    return { title: "Obnova administrátora", severity: "info" as const, entityFallback: "Administrace", needsAttention: false };
  }
  if (failureCode?.startsWith(publicVoucherSubmissionPrefix)) {
    const needsAttention = isCriticalBookingSubmission(failureCode);
    return { title: "Veřejné ověření voucheru", severity: needsAttention ? "error" as const : "info" as const, entityFallback: "Voucher", needsAttention };
  }

  const expectedFailure = expectedBookingFailureCodes.some((code) => code === failureCode);
  const needsAttention = isCriticalBookingSubmission(failureCode);
  const severity: AdminLogSeverity = needsAttention || (outcome === BookingSubmissionOutcome.FAILED && !expectedFailure)
    ? "error"
    : outcome === BookingSubmissionOutcome.SUCCESS
      ? "success"
      : "info";
  const title = outcome === BookingSubmissionOutcome.SUCCESS
    ? "Rezervační formulář úspěšně zpracován"
    : outcome === BookingSubmissionOutcome.BLOCKED
      ? "Odeslání rezervace zablokováno"
      : "Odeslání rezervace selhalo";
  return { title, severity, entityFallback: "Veřejný booking", needsAttention };
}

export function criticalBookingSubmissionWhere(createdAt?: Prisma.DateTimeFilter): Prisma.BookingSubmissionLogWhereInput {
  return {
    outcome: BookingSubmissionOutcome.FAILED,
    ...(createdAt ? { createdAt } : {}),
    OR: [
      { failureCode: { in: [...criticalBookingFailureCodes] } },
      { failureCode: { startsWith: publicVoucherSubmissionPrefix, endsWith: "_UNKNOWN_ERROR" } },
    ],
  };
}

export function parseLogDate(value: string | undefined, end = false) {
  if (!value || !isValidDateKey(value)) return null;
  const { startsAt, endsAt } = getDayBounds(value);
  return end ? endsAt : startsAt;
}

function containsQuery(value: string): Prisma.StringFilter {
  return { contains: value, mode: "insensitive" };
}

export function buildEmailLogWhere(query: string, dateWhere?: Prisma.DateTimeFilter, emailType: "all" | EmailLogType = "all"): Prisma.EmailLogWhereInput {
  return {
    ...(dateWhere ? { createdAt: dateWhere } : {}),
    ...(emailType !== "all" ? { type: emailType } : {}),
    ...(query ? { OR: [
      { recipientEmail: containsQuery(query) }, { subject: containsQuery(query) },
      { templateKey: containsQuery(query) },
      { booking: { is: { OR: [{ clientNameSnapshot: containsQuery(query) }, { serviceNameSnapshot: containsQuery(query) }, { id: containsQuery(query) }] } } },
      { client: { is: { fullName: containsQuery(query) } } },
    ] } : {}),
  };
}

export function getEmailDeliveryWarningWhere(): Prisma.EmailLogWhereInput {
  return {
    OR: [
      { trackingComplainedAt: { not: null } },
      {
        trackingLastEvent: "email.delivery_delayed",
        trackingDeliveredAt: null,
        trackingOpenedAt: null,
        trackingClickedAt: null,
      },
    ],
  };
}

export function buildBookingHistoryWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.BookingStatusHistoryWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { reason: containsQuery(query) }, { note: containsQuery(query) },
    { booking: { is: { OR: [{ id: containsQuery(query) }, { clientNameSnapshot: containsQuery(query) }, { serviceNameSnapshot: containsQuery(query) }] } } },
  ] } : {}) };
}

export function buildAvailabilityAuditWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.AvailabilityAuditEventWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { dateKey: containsQuery(query) }, { source: containsQuery(query) }, { operationId: containsQuery(query) },
    { actorUser: { is: { name: containsQuery(query) } } },
  ] } : {}) };
}

export function availabilityAuditLabel(operation: string) {
  return ({ ADD: "Dostupnost přidána", REMOVE: "Dostupnost odebrána", CLEAR: "Dostupnost dne vyčištěna", COPY_WEEK: "Týden dostupnosti zkopírován", APPLY_TEMPLATE: "Použita šablona týdne", SYNC_DRAFT: "Publikován koncept týdne", UNDO: "Změna dostupnosti vrácena" } as Record<string, string>)[operation] ?? "Dostupnost upravena";
}

export function availabilityAuditDescription(entry: { dateKey: string; before: Prisma.JsonValue; after: Prisma.JsonValue; revertedOperationId: string | null }) {
  const before = (entry.before as { intervals?: Array<{ startsAt: string; endsAt: string }> }).intervals ?? [];
  const after = (entry.after as { intervals?: Array<{ startsAt: string; endsAt: string }> }).intervals ?? [];
  const label = (intervals: Array<{ startsAt: string; endsAt: string }>) => intervals.map((item) => `${formatTime.format(new Date(item.startsAt))}–${formatTime.format(new Date(item.endsAt))}`).join(", ") || "bez dostupnosti";
  return `${entry.dateKey}: ${label(before)} → ${label(after)}${entry.revertedOperationId ? " • vrácení předchozí operace" : ""}`;
}

export function buildRescheduleWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.BookingRescheduleLogWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { reason: containsQuery(query) }, { booking: { is: { OR: [{ id: containsQuery(query) }, { clientNameSnapshot: containsQuery(query) }, { serviceNameSnapshot: containsQuery(query) }] } } },
  ] } : {}) };
}

export function buildVoucherWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.VoucherWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { code: containsQuery(query) }, { purchaserName: containsQuery(query) }, { purchaserEmail: containsQuery(query) }, { recipientName: containsQuery(query) },
  ] } : {}) };
}

export function buildVoucherRedemptionWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.VoucherRedemptionWhereInput {
  return { ...(dateWhere ? { redeemedAt: dateWhere } : {}), ...(query ? { OR: [
    { voucher: { is: { code: containsQuery(query) } } },
    { booking: { is: { OR: [{ id: containsQuery(query) }, { clientNameSnapshot: containsQuery(query) }] } } },
  ] } : {}) };
}

export function buildVoucherChangeWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.VoucherChangeLogWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { voucher: { is: { code: containsQuery(query) } } },
    { actorUser: { is: { name: containsQuery(query) } } },
  ] } : {}) };
}

export function buildServiceChangeWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.ServiceChangeLogWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { service: { is: { OR: [{ name: containsQuery(query) }, { publicName: containsQuery(query) }] } } },
    { actorUser: { is: { name: containsQuery(query) } } },
  ] } : {}) };
}

export function buildServicePriceChangeWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.ServicePriceChangeLogWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { service: { is: { OR: [{ name: containsQuery(query) }, { publicName: containsQuery(query) }] } } },
    { changedByUser: { is: { name: containsQuery(query) } } },
  ] } : {}) };
}

export function buildSiteSettingsChangeWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.SiteSettingsChangeLogWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? {
    actorUser: { is: { name: containsQuery(query) } },
  } : {}) };
}

export function buildAdminUserAuditWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.AdminUserAuditEventWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { targetUser: { is: { OR: [{ name: containsQuery(query) }, { email: containsQuery(query) }] } } },
    { actorUser: { is: { name: containsQuery(query) } } },
  ] } : {}) };
}

function auditValueLabel(value: Prisma.JsonValue | undefined) {
  if (value === null || value === undefined) return "neuvedeno";
  if (typeof value === "boolean") return value ? "Ano" : "Ne";
  if (Array.isArray(value)) return value.join(", ") || "žádné";
  return String(value);
}

function categoryAuditValueLabel(value: Prisma.JsonValue | undefined, categoryNames: Map<string, string>) {
  if (typeof value === "string") return categoryNames.get(value) ?? value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return auditValueLabel(value);
  const snapshot = value as Record<string, Prisma.JsonValue>;
  if (typeof snapshot.categoryName === "string" && snapshot.categoryName) return snapshot.categoryName;
  if (typeof snapshot.categoryId === "string") return categoryNames.get(snapshot.categoryId) ?? snapshot.categoryId;
  return auditValueLabel(value);
}

export function auditChangeDescription(
  beforeValue: Prisma.JsonValue,
  afterValue: Prisma.JsonValue,
  categoryNames = new Map<string, string>(),
) {
  const before = beforeValue && typeof beforeValue === "object" && !Array.isArray(beforeValue) ? beforeValue : {};
  const after = afterValue && typeof afterValue === "object" && !Array.isArray(afterValue) ? afterValue : {};
  const labels: Record<string, string> = {
    role: "Role", isActive: "Aktivní", validUntil: "Platnost do", status: "Stav",
    cancelledAt: "Zrušeno", hasInternalNote: "Interní poznámka", categoryId: "Kategorie",
    purchaserNameChanged: "Jméno kupujícího", purchaserEmailChanged: "E-mail kupujícího",
    internalNoteChanged: "Interní poznámka",
    name: "Název", publicName: "Veřejný název", seoTitle: "SEO titulek",
    durationMinutes: "Délka", cleanupMinutes: "Úklid", sortOrder: "Pořadí",
    isFeaturedOnHomepage: "Na homepage", homepageSortOrder: "Pořadí na homepage",
    isPubliclyBookable: "Rezervovatelná", publicContentFields: "Veřejný obsah",
    bookingMinAdvanceHours: "Minimální předstih", bookingMaxAdvanceDays: "Maximální předstih",
    bookingCancellationHours: "Storno lhůta", salonName: "Název salonu", addressLine: "Adresa",
    city: "Město", postalCode: "PSČ", phone: "Telefon", contactEmail: "Kontaktní e-mail",
    instagramUrl: "Instagram", voucherPdfLogoMediaId: "Logo voucheru",
    notificationAdminEmail: "Notifikační e-mail", emailSenderName: "Jméno odesílatele",
    emailSenderEmail: "E-mail odesílatele", hasEmailFooter: "Patička e-mailu",
  };
  const publicContentLabels: Record<string, string> = {
    description: "popis služby", publicIntro: "úvodní text", seoDescription: "SEO popis",
    idealFor: "pro koho je služba vhodná", includes: "co služba obsahuje", benefits: "výhody",
    goodToKnow: "dobré vědět", pricingShortDescription: "popis v ceníku", pricingBadge: "štítek v ceníku",
  };
  return Object.keys(after).map((key) => {
    if (key === "publicContentFields" && Array.isArray(after[key])) {
      const fields = after[key].map((field) => typeof field === "string" ? publicContentLabels[field] ?? "další veřejný obsah" : "další veřejný obsah");
      return `Veřejný obsah upraven: ${[...new Set(fields)].join(", ") || "žádné položky"}`;
    }
    const label = labels[key] ?? key.replace(/Changed$/, "");
    if (key.endsWith("Changed") && after[key] === true) return `${label}: upraveno`;
    const suffix = key.endsWith("Minutes") ? " min" : key.endsWith("Hours") ? " h" : key.endsWith("Days") ? " dní" : "";
    const beforeLabel = key === "categoryId" ? categoryAuditValueLabel(before[key], categoryNames) : auditValueLabel(before[key]);
    const afterLabel = key === "categoryId" ? categoryAuditValueLabel(after[key], categoryNames) : auditValueLabel(after[key]);
    return `${label}: ${beforeLabel}${suffix} → ${afterLabel}${suffix}`;
  }).join(" • ");
}

export function buildBookingSubmissionWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.BookingSubmissionLogWhereInput {
  const outcome = ["SUCCESS", "FAILED", "BLOCKED"].includes(query.toUpperCase())
    ? query.toUpperCase() as BookingSubmissionOutcome
    : undefined;
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    ...(outcome ? [{ outcome: { equals: outcome } }] : []),
    { failureCode: containsQuery(query) }, { failureReason: containsQuery(query) },
    { booking: { is: { OR: [{ id: containsQuery(query) }, { clientNameSnapshot: containsQuery(query) }, { serviceNameSnapshot: containsQuery(query) }] } } },
    { client: { is: { fullName: containsQuery(query) } } },
  ] } : {}) };
}

export function withBookingSubmissionSeverity(base: Prisma.BookingSubmissionLogWhereInput, severity: "all" | AdminLogSeverity) {
  if (severity === "all") return base;
  const adminScope: Prisma.BookingSubmissionLogWhereInput = {
    OR: adminSubmissionPrefixes.map((prefix) => ({ failureCode: { startsWith: prefix } })),
  };
  const voucherErrorScope: Prisma.BookingSubmissionLogWhereInput = {
    failureCode: { startsWith: publicVoucherSubmissionPrefix, endsWith: "_UNKNOWN_ERROR" },
  };
  const scopes: Record<AdminLogSeverity, Prisma.BookingSubmissionLogWhereInput> = {
    info: { OR: [
      adminScope,
      { failureCode: { startsWith: publicVoucherSubmissionPrefix, not: { endsWith: "_UNKNOWN_ERROR" } } },
      { outcome: BookingSubmissionOutcome.BLOCKED },
      { outcome: BookingSubmissionOutcome.FAILED, failureCode: { in: [...expectedBookingFailureCodes] } },
    ] },
    success: {
      outcome: BookingSubmissionOutcome.SUCCESS,
      OR: [
        { failureCode: null },
        { NOT: { OR: [...adminSubmissionPrefixes.map((prefix) => ({ failureCode: { startsWith: prefix } })), { failureCode: { startsWith: publicVoucherSubmissionPrefix } }] } },
      ],
    },
    warning: { id: "__no_match__" },
    error: { OR: [
      voucherErrorScope,
      {
        outcome: BookingSubmissionOutcome.FAILED,
        NOT: { OR: [adminScope, { failureCode: { startsWith: publicVoucherSubmissionPrefix } }, { failureCode: { in: [...expectedBookingFailureCodes] } }] },
      },
    ] },
  };
  return { AND: [base, scopes[severity]] } satisfies Prisma.BookingSubmissionLogWhereInput;
}

export function withEmailLogScope(
  base: Prisma.EmailLogWhereInput,
  view: AdminLogView,
  severity: "all" | AdminLogSeverity,
  staleBefore: Date,
): Prisma.EmailLogWhereInput {
  const deliveryFailure = getEmailDeliveryFailureWhere();
  const unresolvedDeliveryFailure = getUnresolvedEmailDeliveryFailureWhere();
  const deliveryWarning = getEmailDeliveryWarningWhere();
  const attention: Prisma.EmailLogWhereInput = { OR: [
    unresolvedDeliveryFailure,
    deliveryWarning,
    { status: EmailLogStatus.PENDING, attemptCount: { gt: 0 }, processingStartedAt: null },
    { status: EmailLogStatus.PENDING, processingStartedAt: { lt: staleBefore } },
  ] };
  const bySeverity: Record<AdminLogSeverity, Prisma.EmailLogWhereInput> = {
    error: view === "attention" ? unresolvedDeliveryFailure : deliveryFailure,
    success: { AND: [{ status: EmailLogStatus.SENT }, { NOT: [deliveryFailure, deliveryWarning] }] },
    warning: { AND: [{ NOT: [deliveryFailure] }, { OR: [
      deliveryWarning,
      { status: EmailLogStatus.PENDING, OR: [{ attemptCount: { gt: 0 } }, { processingStartedAt: { lt: staleBefore } }] },
    ] }] },
    info: { status: EmailLogStatus.PENDING, attemptCount: 0, OR: [{ processingStartedAt: null }, { processingStartedAt: { gte: staleBefore } }] },
  };
  const scopes = [base];
  if (view === "attention") scopes.push(attention);
  if (severity !== "all") scopes.push(bySeverity[severity]);
  return scopes.length === 1 ? base : { AND: scopes };
}

export function withBookingHistorySeverity(base: Prisma.BookingStatusHistoryWhereInput, severity: "all" | AdminLogSeverity) {
  if (severity === "all") return base;
  const operationalSource: Prisma.BookingStatusHistoryWhereInput = {
    OR: bookingHistoryOperationalSources.map((source) => ({ metadata: { path: ["source"], equals: source } })),
  };
  const creationReason = { reason: { in: ["public-booking-request-v1", "admin-manual-booking-v1"] } } satisfies Prisma.BookingStatusHistoryWhereInput;
  const scopes: Record<AdminLogSeverity, Prisma.BookingStatusHistoryWhereInput> = {
    info: { OR: [{ status: { in: [BookingStatus.PENDING, BookingStatus.CANCELLED] } }, operationalSource, creationReason] },
    success: { AND: [{ status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } }, { NOT: [operationalSource, creationReason] }] },
    warning: { AND: [{ status: BookingStatus.NO_SHOW }, { NOT: [operationalSource] }] },
    error: { id: "__no_match__" },
  };
  return { AND: [base, scopes[severity]] } satisfies Prisma.BookingStatusHistoryWhereInput;
}

export function normalizeAdminLogView(view: string | undefined, area: AdminArea): AdminLogView {
  const parsed: AdminLogView = ["attention", "events", "emails", "system"].includes(view ?? "")
    ? view as AdminLogView
    : "events";
  return area === "salon" && parsed === "system" ? "events" : parsed;
}

