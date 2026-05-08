import { renderEmailTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/provider";

type TemplateInput = {
  templateKey: string;
  subject: string;
  payload: Record<string, unknown>;
};

const recipientEmail = process.argv[2] ?? "martin@pomykal.cz";
const nowBase = {
  bookingId: "batch-preview-booking",
  serviceName: "Lash lifting",
  clientName: "Jana Nováková",
  scheduledStartsAt: "2026-05-15T08:00:00.000Z",
  scheduledEndsAt: "2026-05-15T09:00:00.000Z",
};

const templates: TemplateInput[] = [
  {
    templateKey: "booking-confirmation-v1",
    subject: "Potvrzení rezervace: Lash lifting",
    payload: {
      ...nowBase,
      manageReservationUrl: "https://ppstudio.cz/rezervace/sprava/preview",
      cancellationUrl: "https://ppstudio.cz/rezervace/storno/preview",
    },
  },
  {
    templateKey: "booking-approved-v1",
    subject: "Rezervace potvrzena: Lash lifting",
    payload: {
      ...nowBase,
      manageReservationUrl: "https://ppstudio.cz/rezervace/sprava/preview",
      cancellationUrl: "https://ppstudio.cz/rezervace/storno/preview",
    },
  },
  {
    templateKey: "booking-reminder-24h-v1",
    subject: "Zítra se na vás těšíme v PP Studiu",
    payload: {
      ...nowBase,
      manageReservationUrl: "https://ppstudio.cz/rezervace/sprava/preview",
      cancellationUrl: "https://ppstudio.cz/rezervace/storno/preview",
    },
  },
  {
    templateKey: "booking-rescheduled-v1",
    subject: "Změna termínu rezervace: Lash lifting",
    payload: {
      ...nowBase,
      previousStartsAt: "2026-05-14T08:00:00.000Z",
      previousEndsAt: "2026-05-14T09:00:00.000Z",
      manageReservationUrl: "https://ppstudio.cz/rezervace/sprava/preview",
      cancellationUrl: "https://ppstudio.cz/rezervace/storno/preview",
    },
  },
  {
    templateKey: "booking-cancelled-v1",
    subject: "Rezervace zrušena: Lash lifting",
    payload: nowBase,
  },
  {
    templateKey: "booking-rejected-v1",
    subject: "Rezervaci se nepodařilo potvrdit: Lash lifting",
    payload: nowBase,
  },
  {
    templateKey: "admin-booking-notification-v1",
    subject: "Nová rezervace: Lash lifting",
    payload: {
      ...nowBase,
      clientEmail: "jana@example.com",
      clientPhone: "+420 777 123 456",
      clientNote: "Prosím o jemnější lepidlo.",
      approveUrl: "https://ppstudio.cz/rezervace/akce/approve/preview",
      rejectUrl: "https://ppstudio.cz/rezervace/akce/reject/preview",
      adminUrl: "https://ppstudio.cz/admin/rezervace/preview",
    },
  },
  {
    templateKey: "admin-booking-cancelled-v1",
    subject: "Rezervace zrušena: Lash lifting",
    payload: {
      ...nowBase,
      clientEmail: "jana@example.com",
    },
  },
];

async function main() {
  console.info(`Sending ${templates.length} templates to ${recipientEmail}...`);

  for (const template of templates) {
    const rendered = await renderEmailTemplate(template.templateKey, template.subject, template.payload);
    const result = await sendEmail({
      to: recipientEmail,
      subject: `[NAHLED] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
      attachments: rendered.attachments,
    });

    console.info(`Sent ${template.templateKey}`, {
      provider: result.provider,
      messageId: result.messageId ?? null,
    });
  }
}

main().catch((error) => {
  console.error("Batch send failed", error);
  process.exitCode = 1;
});
