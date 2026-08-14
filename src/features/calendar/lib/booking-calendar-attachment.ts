import { env } from "@/config/env";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
import { getSalonAddressLine, getSiteSettings } from "@/lib/site-settings";

import { buildCalendarIcs } from "./calendar-ics";

function getCalendarEventUidHost() {
  try {
    return new URL(env.NEXT_PUBLIC_APP_URL).host || "ppstudio.local";
  } catch {
    return "ppstudio.local";
  }
}

function buildBookingCalendarDescription(input: {
  serviceName: string;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
  salonName: string;
  phone: string;
  email: string;
}) {
  return [
    `Služba: ${input.serviceName}`,
    `Termín: ${formatBookingDateLabel(input.scheduledStartsAt, input.scheduledEndsAt)}`,
    `Studio: ${input.salonName}`,
    `Telefon: ${input.phone}`,
    `E-mail: ${input.email}`,
  ].join("\n");
}

export async function buildBookingCalendarIcsFromPayload(input: {
  bookingId: string;
  serviceName: string;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
  salonProfile?: {
    name: string;
    addressLine: string;
    phone: string;
    email: string;
  };
}) {
  const salonProfile = input.salonProfile ?? await getSiteSettings().then((settings) => ({
    name: settings.salonName,
    addressLine: getSalonAddressLine(settings),
    phone: settings.phone,
    email: settings.contactEmail,
  })).catch(() => ({
    name: env.NEXT_PUBLIC_APP_NAME,
    addressLine: "Masarykova 12, 602 00 Brno",
    phone: "+420 777 000 000",
    email: "hello@ppstudio.cz",
  }));
  const uidHost = getCalendarEventUidHost();
  const location = `${salonProfile.name}, ${salonProfile.addressLine}`;

  return buildCalendarIcs({
    productId: "-//PP Studio//Booking Event//CS",
    name: `${salonProfile.name} • rezervace klientky`,
    description: "Jednotlivá potvrzená rezervace salonu PP Studio pro osobní kalendář klientky.",
    events: [
      {
        uid: `${input.bookingId}@${uidHost}`,
        summary: `${salonProfile.name} – ${input.serviceName}`,
        description: buildBookingCalendarDescription({
          serviceName: input.serviceName,
          scheduledStartsAt: input.scheduledStartsAt,
          scheduledEndsAt: input.scheduledEndsAt,
          salonName: salonProfile.name,
          phone: salonProfile.phone,
          email: salonProfile.email,
        }),
        location,
        status: "CONFIRMED",
        startsAt: input.scheduledStartsAt,
        endsAt: input.scheduledEndsAt,
        dtStamp: new Date(),
        lastModified: new Date(),
        sequence: Math.max(0, Math.floor(Date.now() / 1000)),
      },
    ],
  });
}
