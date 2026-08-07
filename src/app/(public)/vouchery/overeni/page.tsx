import type { Metadata } from "next";
import { VoucherType } from "@prisma/client";
import { headers } from "next/headers";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import {
  verifyVoucherPublic,
  voucherValidationReasonCodes,
  type PublicVoucherVerificationResult,
  type VoucherValidationReasonCode,
} from "@/features/vouchers/lib/voucher-validation";
import {
  getRecentVoucherPublicVerificationAttemptCount,
  getVoucherPublicVerificationMetadata,
  isVoucherPublicVerificationRateLimited,
  publicVoucherVerificationSources,
  writeVoucherPublicVerificationAttemptLog,
} from "@/features/vouchers/lib/voucher-public-verification-rate-limit";
import { getPublicSalonProfile } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Ověření dárkového poukazu",
  description: "Veřejné ověření platnosti dárkového poukazu PP Studio.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

type VoucherVerificationPageProps = {
  searchParams: Promise<{
    code?: string | string[];
  }>;
};

type VoucherVerificationViewResult =
  | PublicVoucherVerificationResult
  | {
      ok: false;
      reason: "UNKNOWN" | "RATE_LIMITED";
    };

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Prague",
});

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

export default async function VoucherVerificationPage({
  searchParams,
}: VoucherVerificationPageProps) {
  const { code: codeParam } = await searchParams;
  const requestHeaders = await headers();
  const codeInput = Array.isArray(codeParam) ? codeParam[0] : codeParam;
  const normalizedCode = normalizeVoucherCode(codeInput ?? "");
  const [result, salonProfile] = await Promise.all([
    normalizedCode ? loadVerificationResult(normalizedCode, requestHeaders) : Promise.resolve(null),
    getPublicSalonProfile(),
  ]);
  const studioMessageHref = `mailto:${salonProfile.email}?subject=${encodeURIComponent("Domluva termínu k dárkovému poukazu")}`;

  return (
    <section className="border-b border-black/5 bg-[linear-gradient(180deg,#f8f2eb_0%,#fffaf4_100%)]">
      <Container className="py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
            Dárkový voucher
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-[var(--color-foreground)] sm:text-5xl">
            Ověření dárkového poukazu
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--color-muted)]">
            Naskenovaný poukaz si zde můžete ověřit. Pokud se kód nepředvyplnil, zadejte ho ručně z dárkového poukazu. Ověření pouze čte stav poukazu a nic z něj neodečítá.
          </p>

          <div className="mt-8 rounded-[calc(var(--radius-panel)-0.25rem)] border border-black/8 bg-white/86 p-5 shadow-[var(--shadow-panel)] sm:p-6">
            <form action="/vouchery/overeni" className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
                  Kód voucheru
                </span>
                <input
                  type="text"
                  name="code"
                  defaultValue={normalizedCode}
                  placeholder="PP-2026-XXXXXX"
                  autoComplete="off"
                  className="mt-2 w-full rounded-full border border-black/10 bg-white px-5 py-3 font-mono text-base tracking-[0.08em] text-[var(--color-foreground)] outline-none transition placeholder:tracking-normal placeholder:text-black/32 focus:border-[var(--color-accent)]"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-full bg-[var(--color-foreground)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2c221d] sm:w-auto"
              >
                Ověřit
              </button>
            </form>

            <VerificationResult result={result} studioMessageHref={studioMessageHref} />

            <p className="mt-6 border-t border-black/8 pt-5 text-sm leading-6 text-[var(--color-muted)]">
              Veřejné ověření nezobrazuje kupujícího, e-mail, interní poznámky, historii čerpání, rezervace ani technická ID.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

function VerificationResult({
  result,
  studioMessageHref,
}: {
  result: VoucherVerificationViewResult | null;
  studioMessageHref: string;
}) {
  if (!result) {
    return (
      <div className="mt-5 rounded-[1.25rem] border border-black/8 bg-[#fffaf4] px-4 py-3 text-[var(--color-foreground)]">
        <p className="text-sm font-semibold">Zadejte kód voucheru</p>
        <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
          Kód najdete na dárkovém poukazu nebo v QR odkazu.
        </p>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="mt-5 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
        <p className="text-sm font-semibold">Voucher se nepodařilo ověřit</p>
        <p className="mt-1 text-sm leading-6 opacity-85">
          {result.reason === "UNKNOWN"
            ? getUnknownVerificationMessage()
            : result.reason === "RATE_LIMITED"
              ? getRateLimitedVerificationMessage()
              : getPublicReasonMessage(result.reason)}
        </p>
      </div>
    );
  }

  const bookingSearchParams = new URLSearchParams({ voucher: result.code });

  if (result.type === VoucherType.SERVICE && result.serviceSlug) {
    bookingSearchParams.set("service", result.serviceSlug);
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950">
        <p className="text-sm font-semibold">Voucher je platný</p>
        <p className="mt-1 text-sm leading-6 opacity-85">
          Tento poukaz je v evidenci PP Studia a můžete ho uplatnit při návštěvě.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <VerificationRow label="Kód voucheru" value={result.code} mono />
        <VerificationRow label="Typ" value={getVoucherTypeLabel(result.type)} />
        {result.type === VoucherType.VALUE ? (
          <VerificationRow label="Zbývající hodnota" value={formatCurrency(result.remainingValueCzk ?? 0)} />
        ) : (
          <VerificationRow label="Služba" value={result.serviceNameSnapshot ?? "Služba"} />
        )}
        <VerificationRow label="Platnost do" value={formatDate(result.validUntil)} />
      </dl>

      <div className="rounded-[1.25rem] border border-black/8 bg-[#fffaf4] px-4 py-4 sm:px-5">
        <p className="text-sm font-semibold leading-6 text-[var(--color-foreground)]">
          Chcete si domluvit termín pro uplatnění poukazu?
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/rezervace?${bookingSearchParams.toString()}`}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#2c221d]"
          >
            Rezervovat termín
          </Link>
          <a
            href={studioMessageHref}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/12 bg-white px-5 py-3 text-center text-sm font-semibold text-[var(--color-foreground)] transition hover:border-[var(--color-accent)]"
          >
            Napsat do studia
          </a>
        </div>
      </div>
    </div>
  );
}

function VerificationRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[1.1rem] border border-black/8 bg-[#fffaf4] p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
        {label}
      </dt>
      <dd className={`mt-2 text-sm leading-6 text-[var(--color-foreground)] ${mono ? "font-mono tracking-[0.08em]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function getVoucherTypeLabel(type: VoucherType) {
  switch (type) {
    case VoucherType.VALUE:
      return "Hodnotový poukaz";
    case VoucherType.SERVICE:
      return "Poukaz na službu";
  }
}

function getPublicReasonMessage(reason: VoucherValidationReasonCode) {
  switch (reason) {
    case voucherValidationReasonCodes.draft:
      return "Voucher zatím není aktivní.";
    case voucherValidationReasonCodes.redeemed:
      return "Voucher už byl uplatněn.";
    case voucherValidationReasonCodes.expired:
      return "Voucher je propadlý.";
    case voucherValidationReasonCodes.cancelled:
      return "Voucher není platný. Kontaktujte prosím salon.";
    case voucherValidationReasonCodes.noRemainingValue:
      return "Voucher nemá dostupný zůstatek.";
    case voucherValidationReasonCodes.notFound:
    case voucherValidationReasonCodes.invalidInput:
    case voucherValidationReasonCodes.serviceMismatch:
      return "Voucher nebyl nalezen.";
  }
}

async function loadVerificationResult(code: string, requestHeaders: Headers): Promise<VoucherVerificationViewResult> {
  const requestMetadata = getVoucherPublicVerificationMetadata(requestHeaders);
  const source = publicVoucherVerificationSources.publicPage;
  const ipAttempts = await getRecentVoucherPublicVerificationAttemptCount({
    ...requestMetadata,
    source,
  });

  if (isVoucherPublicVerificationRateLimited(ipAttempts)) {
    await writeVoucherPublicVerificationAttemptLog({
      auditOutcome: "RATE_LIMITED",
      source,
      ipHash: requestMetadata.ipHash,
      userAgent: requestMetadata.userAgent,
      metadata: {
        ipAttempts,
        source,
      },
    });

    return { ok: false, reason: "RATE_LIMITED" };
  }

  try {
    const verificationResult = await verifyVoucherPublic({ code });

    await writeVoucherPublicVerificationAttemptLog({
      auditOutcome:
        verificationResult.ok ? "SUCCESS" : "NOT_FOUND_OR_INVALID",
      source,
      ipHash: requestMetadata.ipHash,
      userAgent: requestMetadata.userAgent,
      metadata: {
        ipAttempts,
        source,
      },
    });

    return verificationResult;
  } catch (error) {
    console.error("Public voucher verification failed", error);

    await writeVoucherPublicVerificationAttemptLog({
      auditOutcome: "UNKNOWN_ERROR",
      source,
      ipHash: requestMetadata.ipHash,
      userAgent: requestMetadata.userAgent,
      metadata: {
        ipAttempts,
        source,
      },
    });

    return { ok: false, reason: "UNKNOWN" };
  }
}

function getUnknownVerificationMessage() {
  return "Ověření teď není dostupné. Zkuste to prosím znovu později.";
}

function getRateLimitedVerificationMessage() {
  return "Příliš mnoho pokusů o ověření. Počkejte prosím chvíli a zkuste to znovu.";
}

function formatCurrency(value: number) {
  return czkFormatter.format(value);
}

function formatDate(value: Date | null) {
  return value ? dateFormatter.format(value) : "Bez omezení";
}
