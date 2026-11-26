import type { BookingEntrySource } from "@/features/booking/components/booking-flow/types";

/** Určuje vstup rezervace podle stránky, na které návštěvník použil CTA. */
export function resolveBookingEntrySource(page: string): BookingEntrySource {
  switch (page.trim().toLocaleLowerCase("cs-CZ")) {
    case "domů":
    case "home":
    case "homepage":
    case "kosmetika zlín":
      return "homepage";
    case "služby":
    case "sluzby":
    case "service_catalog":
      return "service_catalog";
    case "service_detail":
      return "service_detail";
    case "ceník":
    case "cenik":
    case "price_list":
      return "price_list";
    case "dárkové vouchery":
    case "vouchery":
    case "voucher":
      return "voucher";
    case "kontakt":
    case "contact":
      return "contact";
    case "studio":
      return "studio";
    case "faq":
      return "faq";
    default:
      return "other";
  }
}

export function buildBookingEntryHref(href: string, page: string) {
  const url = new URL(href, "https://ppstudio.local");
  url.searchParams.set("source", resolveBookingEntrySource(page));
  return `${url.pathname}${url.search}${url.hash}`;
}
