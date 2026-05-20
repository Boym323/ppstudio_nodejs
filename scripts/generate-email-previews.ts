import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "preview-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const outputDir = path.join(process.cwd(), "tmp", "email-previews");

const baseBookingPayload = {
  bookingId: "preview-booking",
  serviceName: "Luxusní kosmetické ošetření",
  clientName: "Jana Nováková",
  scheduledStartsAt: "2026-05-18T08:00:00.000Z",
  scheduledEndsAt: "2026-05-18T09:30:00.000Z",
};

const previews = [
  {
    filename: "01-potvrzeni-rezervace-luxusni-kosmeticke-osetreni.html",
    templateKey: "booking-confirmation-v1",
    subject: "Potvrzení rezervace: Luxusní kosmetické ošetření",
    payload: {
      ...baseBookingPayload,
      manageReservationUrl: "https://ppstudio.cz/rezervace/sprava/preview",
      cancellationUrl: "https://ppstudio.cz/rezervace/storno/preview",
    },
  },
  {
    filename: "02-rezervace-potvrzena-luxusni-kosmeticke-osetreni.html",
    templateKey: "booking-approved-v1",
    subject: "Rezervace potvrzena: Luxusní kosmetické ošetření",
    payload: {
      ...baseBookingPayload,
      manageReservationUrl: "https://ppstudio.cz/rezervace/sprava/preview",
      cancellationUrl: "https://ppstudio.cz/rezervace/storno/preview",
    },
  },
  {
    filename: "03-pripominka-rezervace-zitra-v-pp-studio.html",
    templateKey: "booking-reminder-24h-v1",
    subject: "Zítra se na vás těšíme v PP Studiu",
    payload: {
      ...baseBookingPayload,
      cancellationUrl: "https://ppstudio.cz/rezervace/storno/preview",
    },
  },
  {
    filename: "04-zmena-terminu-rezervace.html",
    templateKey: "booking-rescheduled-v1",
    subject: "Změna termínu rezervace: Luxusní kosmetické ošetření",
    payload: {
      ...baseBookingPayload,
      previousStartsAt: "2026-05-17T08:00:00.000Z",
      previousEndsAt: "2026-05-17T09:30:00.000Z",
      manageReservationUrl: "https://ppstudio.cz/rezervace/sprava/preview",
      cancellationUrl: "https://ppstudio.cz/rezervace/storno/preview",
    },
  },
  {
    filename: "05-rezervace-zrusena.html",
    templateKey: "booking-cancelled-v1",
    subject: "Rezervace zrušena: Luxusní kosmetické ošetření",
    payload: baseBookingPayload,
  },
  {
    filename: "06-rezervace-nepotvrzena.html",
    templateKey: "booking-rejected-v1",
    subject: "Rezervaci se nepodařilo potvrdit: Luxusní kosmetické ošetření",
    payload: baseBookingPayload,
  },
  {
    filename: "07-admin-nova-rezervace.html",
    templateKey: "admin-booking-notification-v1",
    subject: "Nová rezervace: Luxusní kosmetické ošetření",
    payload: {
      ...baseBookingPayload,
      clientEmail: "jana@example.com",
      clientPhone: "+420 777 123 456",
      clientNote: "Prosím o konzultaci před začátkem.",
      approveUrl: "https://ppstudio.cz/rezervace/akce/approve/preview",
      rejectUrl: "https://ppstudio.cz/rezervace/akce/reject/preview",
      adminUrl: "https://ppstudio.cz/admin/rezervace/preview-booking",
    },
  },
  {
    filename: "08-admin-presunuta-rezervace.html",
    templateKey: "admin-booking-rescheduled-v1",
    subject: "Přesunutá rezervace: Luxusní kosmetické ošetření",
    payload: {
      ...baseBookingPayload,
      clientEmail: "jana@example.com",
      previousStartsAt: "2026-05-17T08:00:00.000Z",
      previousEndsAt: "2026-05-17T09:30:00.000Z",
      adminUrl: "https://ppstudio.cz/admin/rezervace/preview-booking",
    },
  },
];

async function main() {
  const { renderEmailTemplate } = await import("../src/lib/email/templates");

  await mkdir(outputDir, { recursive: true });

  for (const preview of previews) {
    const rendered = await renderEmailTemplate(preview.templateKey, preview.subject, preview.payload);
    await writeFile(path.join(outputDir, preview.filename), rendered.html, "utf8");
  }

  console.log(`Email previews generated in ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
