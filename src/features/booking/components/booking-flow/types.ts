import type { PublicBookingCatalog } from "@/features/booking/lib/booking-public";
import type { getPublicSalonProfile } from "@/lib/site-settings";

export type BookingFlowProps = {
  catalog: PublicBookingCatalog;
  initialSelectedServiceSlug?: string;
  salonProfile: Awaited<ReturnType<typeof getPublicSalonProfile>>;
};

export type ContactFieldKey = "fullName" | "email" | "phone";

export type ServiceCategory = {
  key: string;
  label: string;
  serviceCount: number;
};
