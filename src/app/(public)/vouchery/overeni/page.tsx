import type { Metadata } from "next";
import Link from "next/link";
import { VoucherStatus } from "@prisma/client";

import { Container } from "@/components/ui/container";
import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { getVoucherByCodeSafe } from "@/features/vouchers/lib/voucher-read-models";

export const metadata: Metadata = {
  title: "Ověření voucheru | PP Studio",
  description: "Veřejné ověření platnosti dárkového voucheru PP Studio.",
};

type VoucherVerificationPageProps = {
  searchParams: Promise<{
    code?: string | string[];
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Prague",
});

export default async function VoucherVerificationPage({
  searchParams,
}: VoucherVerificationPageProps) {
  const { code: codeParam } = await searchParams;
  const codeInput = Array.isArray(codeParam) ? codeParam[0] : codeParam;
  const normalizedCode = normalizeVoucherCode(codeInput ?? "");
  const voucher = normalizedCode ? await getVoucherByCodeSafe(normalizedCode) : null;
  const state = getVerificationState(voucher?.effectiveStatus ?? null, Boolean(normalizedCode));

  return (
    <section className="border-b border-black/5 bg-[linear-gradient(180deg,#f8f2eb_0%,#fffaf4_100%)]">
      <Container className="py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
            Dárkový voucher
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-[var(--color-foreground)] sm:text-5xl">
            Ověření voucheru
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--color-muted)]">
            Zkontrolujte kód z dárkového poukazu před rezervací nebo návštěvou salonu.
          </p>

          <div className="mt-8 rounded-[calc(var(--radius-panel)-0.25rem)] border border-black/8 bg-white/86 p-5 shadow-[var(--shadow-panel)] sm:p-6">
            <div className={`rounded-[1.25rem] border px-4 py-3 ${state.className}`}>
              <p className="text-sm font-semibold">{state.title}</p>
              <p className="mt-1 text-sm leading-6 opacity-80">{state.description}</p>
            </div>

            {voucher ? (
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <VerificationRow label="Kód" value={voucher.code} mono />
                <VerificationRow label="Stav" value={voucher.statusLabel} />
                <VerificationRow label="Typ" value={voucher.typeLabel} />
                <VerificationRow label="Hodnota / služba" value={voucher.valueLabel} />
                <VerificationRow label="Zbývá" value={voucher.remainingLabel} />
                <VerificationRow label="Platnost do" value={formatDate(voucher.validUntil)} />
              </dl>
            ) : (
              <form action="/vouchery/overeni" className="mt-5 flex flex-col gap-3 sm:flex-row">
                <label className="min-w-0 flex-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
                    Kód voucheru
                  </span>
                  <input
                    type="text"
                    name="code"
                    defaultValue={normalizedCode}
                    placeholder="PP-2026-XXXXXX"
                    className="mt-2 w-full rounded-full border border-black/10 bg-white px-5 py-3 font-mono text-sm tracking-[0.08em] text-[var(--color-foreground)] outline-none transition placeholder:tracking-normal placeholder:text-black/32 focus:border-[var(--color-accent)]"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-6 rounded-full bg-[var(--color-foreground)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2c221d] sm:self-end"
                >
                  Ověřit
                </button>
              </form>
            )}

            <div className="mt-6 flex flex-col gap-3 border-t border-black/8 pt-5 text-sm leading-6 text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
              <p>Veřejné ověření nezobrazuje kupujícího, interní poznámky ani historii čerpání.</p>
              <Link
                href="/rezervace"
                className="inline-flex justify-center rounded-full border border-black/10 px-4 py-2 font-semibold text-[var(--color-foreground)] transition hover:border-black/20 hover:bg-black/[0.03]"
              >
                Rezervovat termín
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
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

function getVerificationState(status: VoucherStatus | null, hasCode: boolean) {
  if (!hasCode) {
    return {
      title: "Zadejte kód voucheru",
      description: "Kód najdete na dárkovém poukazu nebo v QR odkazu.",
      className: "border-black/8 bg-[#fffaf4] text-[var(--color-foreground)]",
    };
  }

  if (!status) {
    return {
      title: "Voucher nebyl nalezen",
      description: "Zkontrolujte prosím kód z poukazu. Pokud problém trvá, ozvěte se studiu.",
      className: "border-red-200 bg-red-50 text-red-950",
    };
  }

  if (status === VoucherStatus.ACTIVE || status === VoucherStatus.PARTIALLY_REDEEMED) {
    return {
      title: "Voucher je platný",
      description: "Kód je v evidenci PP Studia a je možné ho použít podle uvedeného typu a zůstatku.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    };
  }

  return {
    title: "Voucher nelze použít",
    description: "Voucher je v evidenci, ale jeho aktuální stav už neumožňuje další použití.",
    className: "border-amber-200 bg-amber-50 text-amber-950",
  };
}

function formatDate(value: Date | null) {
  return value ? dateFormatter.format(value) : "Bez omezení";
}
