import { BookingSubmissionOutcome, EmailIncidentResolutionKind, EmailLogStatus, EmailLogType, Prisma } from "@/generated/prisma/client";

import type { AdminArea } from "@/config/navigation";
import { getAdminBookingHref } from "@/features/admin/lib/booking/booking-display";
import { formatServicePrice } from "@/features/admin/lib/admin-service-format";
import { getEmailWorkerStaleBefore, isEmailWorkerClaimStale } from "@/lib/email/booking-delivery-fence";
import { deriveTrackingState } from "@/lib/email/resend-webhooks";
import { getEmailDeliveryFailureWhere, getUnresolvedEmailDeliveryIncidentRootWhere, isEmailDeliveryFailure } from "@/lib/email/incidents";
import { prisma } from "@/lib/prisma";

import {
  getEmailLogSeverity,
  getEmailRecentStatus,
  getEmailRecentStatusLabel,
  getErrorSummary,
  getWorkerSummary,
} from "./email-log-presentations";
import * as filters from "./email-log-filters";
import {
  countDeduplicatedBookingHistory,
  findDeduplicatedBookingHistoryIds,
} from "./email-log-vouchers";
import {
  getAdminLogCandidatePlan,
  getAdminLogPageMeta,
  sortAndPageAdminLogItems,
} from "./email-log-pagination";
import { adminLogPageSize } from "./email-log-types";
import type { AdminLogItem, AdminLogSeverity, AdminLogSource, AdminLogsData } from "./email-log-types";

export * from "./email-log-filters";
export * from "./email-log-pagination";
export * from "./email-log-types";
export * from "./email-log-vouchers";
export { getEmailDetailFinalStatus, getEmailLogSeverity } from "./email-log-presentations";
export type { EmailLogDetailData } from "./email-log-presentations";
export { getEmailLogDetailData } from "./email-log-detail";
export { getEmailDeliveryFailureWhere, getEmailDeliveryIncidentRootWhere, getUnresolvedEmailDeliveryFailureWhere, getUnresolvedEmailDeliveryIncidentRootWhere } from "@/lib/email/incidents";

const adminLogQueryConcurrency = 4;
type AdminLogQuery = () => Promise<unknown>;

/** Spouští dotazy feedu paralelně po omezených dávkách, aby nezahltily pool připojení. */
async function runAdminLogQueries<const T extends readonly AdminLogQuery[]>(
  queries: T,
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const results = new Array<unknown>(queries.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= queries.length) return;
      results[index] = await queries[index]();
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(adminLogQueryConcurrency, queries.length) },
      () => worker(),
    ),
  );

  return results as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
}

const {
  adminSubmissionPrefixes,
  availabilityAuditDescription,
  availabilityAuditLabel,
  auditChangeDescription,
  buildAdminUserAuditWhere,
  buildAvailabilityAuditWhere,
  buildBookingSubmissionWhere,
  buildEmailLogWhere,
  buildRescheduleWhere,
  buildServiceChangeWhere,
  buildServicePriceChangeWhere,
  buildSiteSettingsChangeWhere,
  buildVoucherChangeWhere,
  buildVoucherRedemptionWhere,
  buildVoucherWhere,
  criticalBookingSubmissionWhere,
  getBookingHistoryPresentation,
  getBookingSubmissionPresentation,
  getEmailDeliveryWarningWhere,
  normalizeAdminLogView,
  parseLogDate,
  publicVoucherSubmissionPrefix,
  withBookingSubmissionSeverity,
  withEmailLogScope,
} = filters;

/** Sjednocuje celý read-model na serveru; historické tabulky se do klienta neposílají. */
export async function getAdminLogsData(input: {
  area: AdminArea;
  view?: string;
  query?: string;
  severity?: string;
  source?: string;
  emailType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
}): Promise<AdminLogsData> {
  const isOwner = input.area === "owner";
  const safeView = normalizeAdminLogView(input.view, input.area);
  const severity = ["info", "success", "warning", "error"].includes(input.severity ?? "")
    ? input.severity as AdminLogSeverity : "all";
  const source: AdminLogSource = ["email", "booking", "voucher", "service", "settings", "availability", "admin", "submission"].includes(input.source ?? "")
    ? input.source as AdminLogSource : "all";
  const emailType = Object.values(EmailLogType).includes(input.emailType as EmailLogType)
    ? input.emailType as EmailLogType : "all";
  const query = input.query?.trim().slice(0, 120) ?? "";
  const dateFrom = parseLogDate(input.dateFrom);
  const dateTo = parseLogDate(input.dateTo, true);
  const requestedPage = Number.parseInt(input.page ?? "1", 10);
  const now = new Date();
  const staleBefore = getEmailWorkerStaleBefore(now);
  const attentionSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dateWhere = dateFrom || dateTo ? { gte: dateFrom ?? undefined, lt: dateTo ?? undefined } : undefined;
  const emailActive = (safeView === "emails" || safeView === "attention") && (source === "all" || source === "email");
  const bookingActive = safeView === "events" && (source === "all" || source === "booking");
  const voucherActive = safeView === "events" && (source === "all" || source === "voucher");
  const serviceActive = safeView === "events" && (source === "all" || source === "service");
  const settingsActive = isOwner && safeView === "events" && (source === "all" || source === "settings");
  const availabilityActive = safeView === "events" && (source === "all" || source === "availability");
  const adminAuditActive = isOwner && safeView === "system" && (source === "all" || source === "admin");
  const submissionActive = (safeView === "system" || (isOwner && safeView === "attention")) && (source === "all" || source === "submission");
  const emailBaseWhere = buildEmailLogWhere(query, dateWhere, emailType);
  const emailWhere = withEmailLogScope(emailBaseWhere, safeView, severity, staleBefore);
  const attentionIncidentActive = emailActive && safeView === "attention" && (severity === "all" || severity === "error");
  const attentionSupplementActive = emailActive && safeView === "attention" && (severity === "all" || severity === "warning");
  const attentionIncidentWhere = getUnresolvedEmailDeliveryIncidentRootWhere({
    AND: [getEmailDeliveryFailureWhere(), emailBaseWhere],
  });
  // Root určuje identitu i stav resolution. Reprezentant ale musí být failure,
  // který splňuje celý aktivní emailový filtr, aby UI nikdy nezobrazilo jiný log
  // než ten, který incident do filtrovaného výsledku zařadil.
  const attentionRepresentativeFailureWhere: Prisma.EmailLogWhereInput = {
    AND: [getEmailDeliveryFailureWhere(), emailBaseWhere],
  };
  const attentionSupplementWhere: Prisma.EmailLogWhereInput = severity === "all"
    ? { AND: [emailBaseWhere, { NOT: getEmailDeliveryFailureWhere() }, { OR: [
      getEmailDeliveryWarningWhere(),
      { status: EmailLogStatus.PENDING, attemptCount: { gt: 0 }, processingStartedAt: null },
      { status: EmailLogStatus.PENDING, processingStartedAt: { lt: staleBefore } },
    ] }] }
    : withEmailLogScope(emailBaseWhere, "attention", severity, staleBefore);
  const rescheduleWhere = severity === "all" || severity === "info" ? buildRescheduleWhere(query, dateWhere) : { id: "__no_match__" };
  const voucherWhere = severity === "all" || severity === "info" ? buildVoucherWhere(query, dateWhere) : { id: "__no_match__" };
  const redemptionWhere = severity === "all" || severity === "success" ? buildVoucherRedemptionWhere(query, dateWhere) : { id: "__no_match__" };
  const voucherChangeWhere = severity === "all" || severity === "info" ? buildVoucherChangeWhere(query, dateWhere) : { id: "__no_match__" };
  const serviceChangeWhere = severity === "all" || severity === "info" ? buildServiceChangeWhere(query, dateWhere) : { id: "__no_match__" };
  const servicePriceChangeWhere = severity === "all" || severity === "info" ? buildServicePriceChangeWhere(query, dateWhere) : { id: "__no_match__" };
  const siteSettingsChangeWhere = severity === "all" || severity === "info" ? buildSiteSettingsChangeWhere(query, dateWhere) : { id: "__no_match__" };
  const adminUserAuditWhere = severity === "all" || severity === "info" ? buildAdminUserAuditWhere(query, dateWhere) : { id: "__no_match__" };
  const submissionBaseWhere = buildBookingSubmissionWhere(query, dateWhere);
  const systemSubmissionWhere: Prisma.BookingSubmissionLogWhereInput = safeView === "system" && severity === "all"
    ? { AND: [submissionBaseWhere, { OR: [
      { outcome: { not: BookingSubmissionOutcome.SUCCESS } },
      ...adminSubmissionPrefixes.map((prefix) => ({ failureCode: { startsWith: prefix } })),
      { failureCode: { startsWith: publicVoucherSubmissionPrefix } },
    ] }] }
    : submissionBaseWhere;
  const submissionWhere = safeView === "attention"
    ? severity === "all" || severity === "error"
      ? { AND: [submissionBaseWhere, criticalBookingSubmissionWhere({ gte: attentionSince })] }
      : { id: "__no_match__" }
    : withBookingSubmissionSeverity(systemSubmissionWhere, severity);
  const availabilityWhere = severity === "all" || severity === "info" ? buildAvailabilityAuditWhere(query, dateWhere) : { id: "__no_match__" };

  // Stránka společného feedu je globální, proto nestačí vzít jednu stránku z
  // každého zdroje. Nejdřív si spočítáme přesnou množinu a teprve potom
  // načítáme omezený prefix každého zdroje.
  // Při řazení podle (čas, id) nemůže položka za tímto prefixem předběhnout
  // požadovanou globální stránku.
  const eventCounts = safeView === "events" ? await runAdminLogQueries([
    () => bookingActive ? countDeduplicatedBookingHistory({ query, dateFrom, dateTo, severity }) : Promise.resolve(0),
    () => bookingActive ? prisma.bookingRescheduleLog.count({ where: rescheduleWhere }) : Promise.resolve(0),
    () => voucherActive ? prisma.voucher.count({ where: voucherWhere }) : Promise.resolve(0),
    () => voucherActive ? prisma.voucherRedemption.count({ where: redemptionWhere }) : Promise.resolve(0),
    () => voucherActive ? prisma.voucherChangeLog.count({ where: voucherChangeWhere }) : Promise.resolve(0),
    () => serviceActive ? prisma.serviceChangeLog.count({ where: serviceChangeWhere }) : Promise.resolve(0),
    () => serviceActive ? prisma.servicePriceChangeLog.count({ where: servicePriceChangeWhere }) : Promise.resolve(0),
    () => settingsActive ? prisma.siteSettingsChangeLog.count({ where: siteSettingsChangeWhere }) : Promise.resolve(0),
    () => availabilityActive ? prisma.availabilityAuditEvent.count({ where: availabilityWhere }) : Promise.resolve(0),
  ]) : null;
  // Pro E-maily a Technické načteme jen chronologický prefix potřebný
  // ke složení požadované stránky, nikoli všechny historické záznamy.
  const [emailTotal, adminAuditTotal, submissionTotal] = await runAdminLogQueries([
    () => safeView === "emails" && emailActive ? prisma.emailLog.count({ where: emailWhere }) : Promise.resolve(0),
    () => safeView === "system" && adminAuditActive ? prisma.adminUserAuditEvent.count({ where: adminUserAuditWhere }) : Promise.resolve(0),
    () => safeView === "system" && submissionActive ? prisma.bookingSubmissionLog.count({ where: submissionWhere }) : Promise.resolve(0),
  ]);
  const exactSimpleTotal = safeView === "emails" || safeView === "system"
    ? emailTotal + adminAuditTotal + submissionTotal
    : null;
  const simpleMeta = exactSimpleTotal === null ? null : getAdminLogCandidatePlan(exactSimpleTotal, requestedPage);
  const simpleCandidateTake = safeView === "emails" ? adminLogPageSize : simpleMeta?.take;
  const emailPageSkip = safeView === "emails" ? (simpleMeta?.offset ?? 0) : 0;
  const attentionCounts = safeView === "attention" ? await runAdminLogQueries([
    () => attentionIncidentActive ? prisma.emailLog.count({ where: attentionIncidentWhere }) : Promise.resolve(0),
    () => attentionSupplementActive ? prisma.emailLog.count({ where: attentionSupplementWhere }) : Promise.resolve(0),
    () => submissionActive ? prisma.bookingSubmissionLog.count({ where: submissionWhere }) : Promise.resolve(0),
  ]) : null;
  const exactAttentionTotal = attentionCounts ? attentionCounts.reduce((total, count) => total + count, 0) : null;
  const attentionMeta = exactAttentionTotal === null ? null : getAdminLogCandidatePlan(exactAttentionTotal, requestedPage);
  const attentionCandidateTake = attentionMeta?.take;
  const emailCandidateTake = safeView === "attention" ? attentionCandidateTake : simpleCandidateTake;
  const submissionCandidateTake = safeView === "attention" ? attentionCandidateTake : simpleCandidateTake;

  const exactEventTotal = eventCounts ? eventCounts.reduce((total, count) => total + count, 0) : null;
  const eventMeta = exactEventTotal === null ? null : getAdminLogCandidatePlan(exactEventTotal, requestedPage);
  const candidateTake = eventMeta?.take;
  const bookingHistoryCandidateIds = bookingActive && candidateTake
    ? await findDeduplicatedBookingHistoryIds({ query, dateFrom, dateTo, severity, take: candidateTake })
    : [];

  const attentionHealthActive = safeView === "attention";
  const ownerQueueHealthActive = isOwner && safeView === "system";
  const [failed, retry, stuck, pending, processing, critical] = await runAdminLogQueries([
    // Jeden root = jeden incident i při více resend pokusech; badge viditelný ve všech pohledech.
    () => prisma.emailLog.count({ where: getUnresolvedEmailDeliveryIncidentRootWhere() }),
    () => attentionHealthActive || ownerQueueHealthActive ? prisma.emailLog.count({ where: { status: EmailLogStatus.PENDING, attemptCount: { gt: 0 }, processingStartedAt: null } }) : Promise.resolve(0),
    () => attentionHealthActive || ownerQueueHealthActive ? prisma.emailLog.count({ where: { status: EmailLogStatus.PENDING, processingStartedAt: { lt: staleBefore } } }) : Promise.resolve(0),
    () => ownerQueueHealthActive ? prisma.emailLog.count({ where: { status: EmailLogStatus.PENDING, attemptCount: 0, processingStartedAt: null } }) : Promise.resolve(0),
    () => ownerQueueHealthActive ? prisma.emailLog.count({ where: { status: EmailLogStatus.PENDING, processingStartedAt: { not: null } } }) : Promise.resolve(0),
    () => isOwner && safeView === "attention" ? prisma.bookingSubmissionLog.count({ where: criticalBookingSubmissionWhere({ gte: attentionSince }) }) : Promise.resolve(0),
  ]);
  const loadEmails = async () => {
    if (!emailActive) return [];
    if (attentionIncidentActive) {
      const incidents = await prisma.emailLog.findMany({
        where: attentionIncidentWhere,
        ...(attentionCandidateTake ? { take: attentionCandidateTake } : {}),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          booking: { select: { id: true, clientNameSnapshot: true, serviceNameSnapshot: true } },
          client: { select: { fullName: true } },
          incidentResends: {
            where: attentionRepresentativeFailureWhere,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            include: {
              booking: { select: { id: true, clientNameSnapshot: true, serviceNameSnapshot: true } },
              client: { select: { fullName: true } },
            },
          },
        },
      });
      const supplementary = attentionSupplementActive
        ? await prisma.emailLog.findMany({ where: attentionSupplementWhere, ...(attentionCandidateTake ? { take: attentionCandidateTake } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { booking: { select: { id: true, clientNameSnapshot: true, serviceNameSnapshot: true } }, client: { select: { fullName: true } }, resendRoot: { select: { incidentResolvedAt: true, incidentResolvedByEmailLogId: true, incidentResolutionKind: true } } } })
        : [];
      return [
        ...incidents.map((incident) => ({ representativeEmailLog: incident.incidentResends[0] ?? incident, incidentRoot: incident })),
        ...supplementary.map((log) => ({ representativeEmailLog: log, incidentRoot: log.resendRoot ?? log })),
      ];
    }
    const logs = await prisma.emailLog.findMany({ where: emailWhere, ...(emailPageSkip ? { skip: emailPageSkip } : {}), ...(emailCandidateTake ? { take: emailCandidateTake } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { booking: { select: { id: true, clientNameSnapshot: true, serviceNameSnapshot: true } }, client: { select: { fullName: true } }, resendRoot: { select: { incidentResolvedAt: true, incidentResolvedByEmailLogId: true, incidentResolutionKind: true } } } });
    return logs.map((log) => ({ representativeEmailLog: log, incidentRoot: log.resendRoot ?? log }));
  };
  const [emails, bookingHistory, reschedules, vouchers, redemptions, voucherChanges, serviceChanges, servicePriceChanges, siteSettingsChanges, availabilityAudits, adminUserAudits, submissions] = await runAdminLogQueries([
    () => loadEmails(),
    () => bookingHistoryCandidateIds.length > 0 ? prisma.bookingStatusHistory.findMany({ where: { id: { in: bookingHistoryCandidateIds } }, include: { booking: { select: { id: true, clientNameSnapshot: true, serviceNameSnapshot: true } }, actorUser: { select: { name: true } } } }) : Promise.resolve([]),
    () => bookingActive ? prisma.bookingRescheduleLog.findMany({ where: rescheduleWhere, ...(candidateTake ? { take: candidateTake } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { booking: { select: { id: true, clientNameSnapshot: true, serviceNameSnapshot: true } }, changedByUser: { select: { name: true } } } }) : Promise.resolve([]),
    () => voucherActive ? prisma.voucher.findMany({ where: voucherWhere, ...(candidateTake ? { take: candidateTake } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, code: true, createdAt: true, createdByUser: { select: { name: true } } } }) : Promise.resolve([]),
    () => voucherActive ? prisma.voucherRedemption.findMany({ where: redemptionWhere, ...(candidateTake ? { take: candidateTake } : {}), orderBy: [{ redeemedAt: "desc" }, { id: "desc" }], include: { voucher: { select: { id: true, code: true } }, redeemedByUser: { select: { name: true } } } }) : Promise.resolve([]),
    () => voucherActive ? prisma.voucherChangeLog.findMany({ where: voucherChangeWhere, ...(candidateTake ? { take: candidateTake } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { voucher: { select: { id: true, code: true } }, actorUser: { select: { name: true } } } }) : Promise.resolve([]),
    () => serviceActive ? prisma.serviceChangeLog.findMany({ where: serviceChangeWhere, ...(candidateTake ? { take: candidateTake } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { service: { select: { id: true, name: true, publicName: true } }, actorUser: { select: { name: true } } } }) : Promise.resolve([]),
    () => serviceActive ? prisma.servicePriceChangeLog.findMany({ where: servicePriceChangeWhere, ...(candidateTake ? { take: candidateTake } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { service: { select: { id: true, name: true, publicName: true } }, changedByUser: { select: { name: true } } } }) : Promise.resolve([]),
    () => settingsActive ? prisma.siteSettingsChangeLog.findMany({ where: siteSettingsChangeWhere, ...(candidateTake ? { take: candidateTake } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { actorUser: { select: { name: true } } } }) : Promise.resolve([]),
    () => availabilityActive ? prisma.availabilityAuditEvent.findMany({ where: availabilityWhere, ...(candidateTake ? { take: candidateTake } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { actorUser: { select: { name: true } } } }) : Promise.resolve([]),
    () => adminAuditActive ? prisma.adminUserAuditEvent.findMany({ where: adminUserAuditWhere, ...(simpleCandidateTake ? { take: simpleCandidateTake } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { targetUser: { select: { name: true } }, actorUser: { select: { name: true } } } }) : Promise.resolve([]),
    () => submissionActive ? prisma.bookingSubmissionLog.findMany({ where: submissionWhere, ...(submissionCandidateTake ? { take: submissionCandidateTake } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { booking: { select: { id: true, clientNameSnapshot: true, serviceNameSnapshot: true } }, client: { select: { fullName: true } } } }) : Promise.resolve([]),
  ]);
  const categoryIds = serviceChanges.flatMap((entry) => [entry.before, entry.after]
    .map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const categoryValue = value.categoryId;
      if (typeof categoryValue === "string") return categoryValue;
      if (categoryValue && typeof categoryValue === "object" && !Array.isArray(categoryValue) && typeof categoryValue.categoryId === "string") return categoryValue.categoryId;
      return null;
    })
    .filter((id): id is string => id !== null));
  const categoryNames = new Map((categoryIds.length > 0
    ? await prisma.serviceCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
    : [])
    .map((category) => [category.id, category.name]));

  const bookingHref = (id: string) => getAdminBookingHref(input.area, id);
  const voucherHref = (id: string) => `${input.area === "owner" ? "/admin" : "/admin/provoz"}/vouchery/${id}`;
  const items: AdminLogItem[] = [
    ...emails.map(({ representativeEmailLog: log, incidentRoot }) => {
      const tracking = deriveTrackingState(log);
      const logSeverity = getEmailLogSeverity({ ...log, staleBefore });
      const status = getEmailRecentStatus(log.status, log.processingStartedAt, log.attemptCount);
      const isStuck = log.processingToken !== null
        && isEmailWorkerClaimStale(log.processingStartedAt, now);
      const primaryAction: AdminLogItem["primaryAction"] = isOwner
        ? (safeView === "emails" && isEmailDeliveryFailure(log) ? "detail" : isStuck ? "release" : status === "failed" || status === "retry" ? "retry" : "detail")
        : null;
      const incidentResolutionKind = incidentRoot.incidentResolutionKind
        ?? (incidentRoot.incidentResolvedByEmailLogId ? EmailIncidentResolutionKind.DELIVERED_RESEND : null);
      const failure = tracking.value === "failed" || log.status === EmailLogStatus.FAILED;
      const emailBadge: NonNullable<AdminLogItem["emailBadge"]> = failure
        ? incidentRoot.incidentResolvedAt
          ? { label: "Incident uzavřen", severity: "info", detail: tracking.value === "failed" ? tracking.label : null }
          : { label: "Nedoručeno", severity: "error", detail: tracking.value === "failed" ? tracking.label : null }
        : tracking.value === "retry"
          ? { label: log.trackingComplainedAt ? "Spam" : "Zpožděno", severity: "warning", detail: tracking.label }
          : tracking.value === "sent"
            ? { label: "Doručeno", severity: "success", detail: tracking.label === "Doručeno" ? null : tracking.label }
            : log.status === EmailLogStatus.SENT || tracking.value === "processing"
              ? { label: "Odesláno", severity: "info", detail: tracking.value === "processing" ? tracking.label : "Doručení zatím nepotvrzeno webhookem" }
              : isStuck
                ? { label: "Zdržení", severity: "warning", detail: "Odesílání trvá neobvykle dlouho" }
                : status === "retry"
                  ? { label: "Další pokus", severity: "warning", detail: getEmailRecentStatusLabel(log.status, log.processingStartedAt, log.attemptCount) }
                  : status === "processing"
                    ? { label: "Odesílá se", severity: "info", detail: null }
                    : { label: "Ve frontě", severity: "info", detail: null };
      const incidentResolutionLabel = incidentRoot.incidentResolvedAt && failure
        ? incidentResolutionKind === EmailIncidentResolutionKind.MANUAL
          ? " • Ručně uzavřeno"
          : " • Vyřešeno následným odesláním"
        : "";
      const serviceName = log.booking?.serviceNameSnapshot.trim();
      const subjectContainsService = safeView === "emails" && serviceName
        && log.subject.toLocaleLowerCase("cs-CZ").includes(serviceName.toLocaleLowerCase("cs-CZ"));
      const entityLabel = log.booking
        ? subjectContainsService ? log.booking.clientNameSnapshot : `${log.booking.clientNameSnapshot} • ${log.booking.serviceNameSnapshot}`
        : log.client?.fullName ?? null;
      return { id: `email:${log.id}`, occurredAt: log.createdAt.toISOString(), category: "email" as const, severity: logSeverity, title: log.subject, description: `${log.recipientEmail}${incidentResolutionLabel}${log.errorMessage ? ` • ${getErrorSummary(log.errorMessage)}` : ""}`, actorLabel: null, entityLabel, entityHref: log.booking ? bookingHref(log.booking.id) : null, sourceType: "email" as const, sourceId: log.id, primaryAction, emailLogId: log.id, queueState: getEmailRecentStatusLabel(log.status, log.processingStartedAt, log.attemptCount), trackingState: tracking.label, emailBadge };
    }),
    ...bookingHistory.map((entry) => {
      const presentation = getBookingHistoryPresentation(entry);
      return { id: `booking-history:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: presentation.severity, title: presentation.title, description: presentation.description ?? entry.note, actorLabel: entry.actorUser?.name ?? (entry.actorType === "CLIENT" ? "Klientka" : entry.actorType === "SYSTEM" ? "Systém" : null), entityLabel: entry.booking ? `${entry.booking.clientNameSnapshot} • ${entry.booking.serviceNameSnapshot}` : "Odstraněná rezervace", entityHref: entry.booking ? bookingHref(entry.booking.id) : null, sourceType: "booking" as const, sourceId: entry.id, primaryAction: entry.booking ? "open" as const : null };
    }),
    ...reschedules.map((entry) => ({ id: `booking-reschedule:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: "Rezervace přesunuta", description: entry.reason, actorLabel: entry.changedByUser?.name ?? (entry.changedByClient ? "Klientka" : null), entityLabel: entry.booking ? `${entry.booking.clientNameSnapshot} • ${entry.booking.serviceNameSnapshot}` : "Odstraněná rezervace", entityHref: entry.booking ? bookingHref(entry.booking.id) : null, sourceType: "booking" as const, sourceId: entry.id, primaryAction: entry.booking ? "open" as const : null })),
    ...vouchers.map((voucher) => ({ id: `voucher:${voucher.id}`, occurredAt: voucher.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: "Voucher vytvořen", description: null, actorLabel: voucher.createdByUser?.name ?? null, entityLabel: `Voucher ${voucher.code}`, entityHref: voucherHref(voucher.id), sourceType: "voucher" as const, sourceId: voucher.id, primaryAction: "open" as const })),
    ...(voucherActive ? redemptions.map((redemption) => ({ id: `voucher-redemption:${redemption.id}`, occurredAt: redemption.redeemedAt.toISOString(), category: "event" as const, severity: "success" as const, title: "Voucher uplatněn", description: null, actorLabel: redemption.redeemedByUser?.name ?? null, entityLabel: redemption.voucher ? `Voucher ${redemption.voucher.code}` : "Odstraněný voucher", entityHref: redemption.voucher ? voucherHref(redemption.voucher.id) : null, sourceType: "voucher" as const, sourceId: redemption.id, primaryAction: redemption.voucher ? "open" as const : null })) : []),
    ...voucherChanges.map((entry) => ({ id: `voucher-change:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: entry.operation === "CANCEL" ? "Voucher zrušen" : "Voucher upraven", description: auditChangeDescription(entry.before, entry.after), actorLabel: entry.actorUser.name, entityLabel: `Voucher ${entry.voucher.code}`, entityHref: voucherHref(entry.voucher.id), sourceType: "voucher" as const, sourceId: entry.id, primaryAction: "open" as const })),
    ...serviceChanges.map((entry) => ({ id: `service-change:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: "Služba upravena", description: auditChangeDescription(entry.before, entry.after, categoryNames), actorLabel: entry.actorUser.name, entityLabel: entry.service.publicName ?? entry.service.name, entityHref: `${input.area === "owner" ? "/admin" : "/admin/provoz"}/sluzby?serviceId=${entry.service.id}`, sourceType: "service" as const, sourceId: entry.id, primaryAction: "open" as const })),
    ...servicePriceChanges.map((entry) => ({ id: `service-price-change:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: "Cena služby změněna", description: `${formatServicePrice(entry.oldPriceFromCzk)} → ${formatServicePrice(entry.newPriceFromCzk)}`, actorLabel: entry.changedByUser?.name ?? null, entityLabel: entry.service.publicName ?? entry.service.name, entityHref: `${input.area === "owner" ? "/admin" : "/admin/provoz"}/sluzby?serviceId=${entry.service.id}`, sourceType: "service" as const, sourceId: entry.id, primaryAction: "open" as const })),
    ...siteSettingsChanges.map((entry) => ({ id: `settings-change:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: entry.operation === "UPDATE_BOOKING_POLICY" ? "Pravidla rezervace upravena" : entry.operation === "UPDATE_SALON" ? "Údaje salonu upraveny" : entry.operation === "UPDATE_VOUCHER_POLICY" ? "Nastavení voucherů upravena" : "E-mailová nastavení upravena", description: auditChangeDescription(entry.before, entry.after), actorLabel: entry.actorUser.name, entityLabel: "Nastavení webu", entityHref: "/admin/nastaveni", sourceType: "settings" as const, sourceId: entry.id, primaryAction: "open" as const })),
    ...availabilityAudits.map((entry) => ({ id: `availability:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: availabilityAuditLabel(entry.operation), description: availabilityAuditDescription(entry), actorLabel: entry.actorUser?.name ?? null, entityLabel: `Volné termíny • ${entry.dateKey}`, entityHref: `${input.area === "owner" ? "/admin" : "/admin/provoz"}/volne-terminy?week=${entry.dateKey}&day=${entry.dateKey}`, sourceType: "availability" as const, sourceId: entry.id, primaryAction: "open" as const })),
    ...adminUserAudits.map((entry) => ({ id: `admin-user-audit:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "system" as const, severity: "info" as const, title: ({ CREATE: "Admin účet vytvořen", UPDATE_PROFILE: "Admin účet upraven", CHANGE_ROLE: "Role admina změněna", ACTIVATE: "Admin účet aktivován", DEACTIVATE: "Admin účet deaktivován", INVITE_RESEND: "Pozvánka znovu vydána" } as Record<string, string>)[entry.operation] ?? "Admin účet upraven", description: auditChangeDescription(entry.before, entry.after), actorLabel: entry.actorUser.name, entityLabel: entry.targetUser.name, entityHref: "/admin/uzivatele", sourceType: "admin" as const, sourceId: entry.id, primaryAction: "open" as const })),
    ...submissions.map((entry) => {
      const presentation = getBookingSubmissionPresentation(entry);
      return { id: `submission:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "system" as const, severity: presentation.severity, title: presentation.title, description: entry.failureReason ?? entry.failureCode, actorLabel: "Systém", entityLabel: entry.booking ? `${entry.booking.clientNameSnapshot} • ${entry.booking.serviceNameSnapshot}` : entry.client?.fullName ?? presentation.entityFallback, entityHref: entry.booking ? bookingHref(entry.booking.id) : null, sourceType: "submission" as const, sourceId: entry.id, primaryAction: entry.booking ? "open" as const : null };
    }),
  ];
  const visible = items.filter((item) => {
    if (safeView === "attention" && item.severity !== "error" && !(item.sourceType === "email" && item.severity === "warning")) return false;
    if (safeView === "events" && item.category !== "event") return false;
    if (safeView === "emails" && item.category !== "email") return false;
    if (severity !== "all" && item.severity !== severity) return false;
    if (source !== "all" && item.sourceType !== source) return false;
    return true;
  });
  const deduplicatedTotal = exactAttentionTotal ?? exactEventTotal ?? exactSimpleTotal ?? visible.length;
  const deduplicatedMeta = attentionMeta ?? eventMeta ?? simpleMeta ?? getAdminLogPageMeta(deduplicatedTotal, requestedPage);
  return { area: input.area, view: safeView, items: sortAndPageAdminLogItems(visible, safeView === "emails" ? 1 : deduplicatedMeta.page), total: deduplicatedTotal, page: deduplicatedMeta.page, pageCount: deduplicatedMeta.pageCount, pageSize: adminLogPageSize, filters: { query, severity, source, emailType, dateFrom: input.dateFrom ?? "", dateTo: input.dateTo ?? "" }, attention: { failed, retry, stuck, critical }, queueStats: [{ label: "Čeká", value: String(pending), tone: pending ? "accent" : "muted" }, { label: "Retry", value: String(retry), tone: retry ? "accent" : "muted" }, { label: "Zpracovává se", value: String(processing), tone: processing ? "accent" : "muted" }, { label: "Aktivní incidenty", value: String(failed), tone: failed ? "accent" : "muted" }], workerSummary: getWorkerSummary({ pending, retrying: retry, processing, failed }) };
}
