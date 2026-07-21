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

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store",
};

export function createAdminVoucherLookupRouteApi(deps?: {
  getSession?: typeof getSession;
  isSameOriginAdminRequest?: typeof isSameOriginAdminRequest;
  findVoucher?: typeof prisma.voucher.findUnique;
}) {
  const getSessionImpl = deps?.getSession ?? getSession;
  const isSameOriginAdminRequestImpl = deps?.isSameOriginAdminRequest ?? isSameOriginAdminRequest;
  const findVoucherImpl = deps?.findVoucher ?? prisma.voucher.findUnique.bind(prisma.voucher);

  return {
    async POST(request: Request) {
      if (!isSameOriginAdminRequestImpl(request)) {
        return NextResponse.json(
          {
            status: "error",
            message: "Požadavek neprošel kontrolou původu.",
          },
          { status: 403, headers: privateNoStoreHeaders },
        );
      }

      const session = await getSessionImpl();
      if (!session || ![AdminRole.OWNER, AdminRole.SALON].includes(session.role)) {
        return NextResponse.json(
          {
            status: "error",
            message: "Do této sekce mají přístup jen přihlášení admin uživatelé.",
          },
          { status: 403, headers: privateNoStoreHeaders },
        );
      }

      const body = await request.json().catch(() => null);
      const parsed = lookupVoucherSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            status: "error",
            message: "Zadejte platný kód voucheru.",
          },
          { status: 400, headers: privateNoStoreHeaders },
        );
      }

      const normalizedCode = normalizeVoucherCode(parsed.data.voucherCode);
      const voucher = await findVoucherImpl({
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
          { status: 404, headers: privateNoStoreHeaders },
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
        { status: 200, headers: privateNoStoreHeaders },
      );
    },
  };
}
