import { AdminRole, VoucherType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { formatVoucherStatus, getEffectiveVoucherStatus } from "@/features/vouchers/lib/voucher-format";
import { getSession } from "@/lib/auth/session";
import { isSameOriginAdminRequest } from "@/lib/http/request-origin";
import { prisma } from "@/lib/prisma";

const lookupVoucherSchema = z.object({
  voucherCode: z.string().trim().min(1).max(64),
});

async function handleLookupVoucher(voucherCodeRaw: string) {
  const session = await getSession();
  if (!session || ![AdminRole.OWNER, AdminRole.SALON].includes(session.role)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Do této sekce mají přístup jen přihlášení admin uživatelé.",
      },
      { status: 403 },
    );
  }

  const parsed = lookupVoucherSchema.safeParse({
    voucherCode: voucherCodeRaw,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        message: "Zadejte platný kód voucheru.",
      },
      { status: 400 },
    );
  }

  const normalizedCode = normalizeVoucherCode(parsed.data.voucherCode);
  const voucher = await prisma.voucher.findUnique({
    where: { code: normalizedCode },
    select: {
      code: true,
      type: true,
      status: true,
      validUntil: true,
      remainingValueCzk: true,
      serviceNameSnapshot: true,
      servicePriceSnapshotCzk: true,
    },
  });

  if (!voucher) {
    return NextResponse.json(
      {
        status: "error",
        message: "Voucher se nepodařilo najít.",
      },
      { status: 404 },
    );
  }

  const effectiveStatus = getEffectiveVoucherStatus(voucher);

  return NextResponse.json(
    {
      status: "success",
      voucher: {
        code: voucher.code,
        type: voucher.type,
        typeLabel: voucher.type === VoucherType.VALUE ? "Hodnotový poukaz" : "Poukaz na službu",
        status: effectiveStatus,
        statusLabel: formatVoucherStatus(effectiveStatus),
        remainingValueCzk: voucher.type === VoucherType.VALUE ? (voucher.remainingValueCzk ?? 0) : null,
        serviceNameSnapshot: voucher.serviceNameSnapshot,
        servicePriceSnapshotCzk: voucher.servicePriceSnapshotCzk,
      },
    },
    { status: 200 },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const voucherCode = searchParams.get("voucherCode") ?? "";

  return handleLookupVoucher(voucherCode);
}

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Požadavek neprošel kontrolou původu.",
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const voucherCode = typeof body?.voucherCode === "string" ? body.voucherCode : "";

  return handleLookupVoucher(voucherCode);
}
