import type { PublicBookingCatalog } from "@/features/booking/lib/booking-public";
import type { getPublicSalonProfile } from "@/lib/site-settings";

export type BookingFlowProps = {
  catalog: PublicBookingCatalog;
  initialSelectedServiceSlug?: string;
  initialVoucherCode?: string;
  bookingEntrySource: BookingEntrySource;
  salonProfile: Awaited<ReturnType<typeof getPublicSalonProfile>>;
};

export type BookingEntrySource =
  | "service_detail"
  | "service_catalog"
  | "price_list"
  | "homepage"
  | "voucher"
  | "contact"
  | "studio"
  | "faq"
  | "about"
  | "privacy_policy"
  | "terms_and_conditions"
  | "cancellation_policy"
  | "cancellation_unavailable"
  | "cancellation"
  | "direct_booking"
  | "other";

export type ContactFieldKey = "fullName" | "email" | "phone";
export type ContactAnalyticsField = "email" | "phone" | "clientNote";

export type ServiceCategory = {
  key: string;
  label: string;
  serviceCount: number;
};
