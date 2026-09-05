"use server";

import { z } from "zod";

import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import { getAdminBookingDetailData } from "@/features/admin/lib/booking/booking-detail";

const inputSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  action: z.enum(["CONFIRMED", "COMPLETED"]),
});

export async function getDashboardBookingAction(input: z.infer<typeof inputSchema>) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return null;

  const { area, bookingId, action } = parsed.data;
  await requireAdminSectionAccess(area, "rezervace");
  const data = await getAdminBookingDetailData(area, bookingId);
  if (!data) return null;

  const availableActions = data.availableActions.filter((option) => option.value === action);
  if (!availableActions.length) return null;

  return {
    clientName: data.clientName,
    serviceName: data.serviceName,
    scheduledAtLabel: data.scheduledAtLabel,
    form: {
      area,
      bookingId: data.id,
      bookingStatus: data.status,
      clientEmail: data.clientEmail,
      availableActions,
      initialVoucherCode: data.voucher.intendedVoucher?.code ?? data.voucher.intendedVoucherCodeSnapshot ?? "",
      remainingPaymentCzk: data.voucher.paymentSummary.remainingCzk,
      totalPriceCzk: data.voucher.paymentSummary.totalPriceCzk ?? data.effectivePriceCzk,
      directPaidCzk: data.voucher.paymentSummary.directPaidCzk,
      voucherPaidCzk: data.voucher.paymentSummary.voucherPaidCzk,
      overpaidCzk: data.voucher.paymentSummary.overpaidCzk,
    },
  };
}
