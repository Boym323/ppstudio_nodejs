/**
 * Stabilní neosobní kroky rezervačního procesu, nezávislé na pomocných interakcích.
 * Při obnově konceptu nebo předvýběru služby se doplní i dosažené předchozí kroky.
 */
export const BOOKING_FUNNEL_STAGES = [
  "viewed",
  "service",
  "term",
  "contact",
  "submitted",
  "created",
] as const;

export type BookingFunnelStage = (typeof BOOKING_FUNNEL_STAGES)[number];

export const BOOKING_FUNNEL_ACTIONS: Record<BookingFunnelStage, string> = {
  viewed: "01 Otevření rezervace",
  service: "02 Vybraná služba",
  term: "03 Vybraný termín",
  contact: "04 Kontaktní krok",
  submitted: "05 Odeslání rezervace",
  created: "06 Vytvořená rezervace",
};

/** Vrátí nové kroky v chronologickém pořadí. Neodesílá identifikátory klientek. */
export function getBookingFunnelStagesSince(
  lastTrackedStageIndex: number,
  nextStage: BookingFunnelStage,
): BookingFunnelStage[] {
  const nextIndex = BOOKING_FUNNEL_STAGES.indexOf(nextStage);
  return BOOKING_FUNNEL_STAGES.slice(lastTrackedStageIndex + 1, nextIndex + 1);
}
