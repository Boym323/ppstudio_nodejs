import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";

import { AdminBookingSettingsForm } from "./admin-booking-settings-form";
import { AdminCalendarSettingsForm } from "./admin-calendar-settings-form";
import { AdminEmailSettingsForm } from "./admin-email-settings-form";
import { AdminPushoverSettingsForm } from "./admin-pushover-settings-form";
import { AdminSalonSettingsForm } from "./admin-salon-settings-form";

export function AdminSettingsPage({
  settings,
}: {
  settings: {
    salonName: string;
    addressLine: string;
    city: string;
    postalCode: string;
    phone: string;
    contactEmail: string;
    instagramUrl: string | null;
    voucherPdfLogoMediaId: string | null;
    contactPhotoMediaId: string | null;
    homePortraitMediaId: string | null;
    aboutPortraitMediaId: string | null;
    publishedMediaOptions: Array<{
      id: string;
      title: string | null;
      fileName: string;
      mimeType: string;
      altText: string | null;
      thumbnailPublicUrl: string | null;
      publicUrl: string | null;
    }>;
    bookingMinAdvanceHours: number;
    bookingMaxAdvanceDays: number;
    bookingCancellationHours: number;
    autoLunchEnabled: boolean;
    notificationAdminEmail: string;
    emailSenderName: string;
    emailSenderEmail: string;
    emailFooterText: string | null;
    updatedAt: string;
    calendarFeed: {
      isActive: boolean;
      subscriptionUrl: string | null;
      updatedAtLabel: string;
      rotatedAtLabel: string | null;
      revokedAtLabel: string | null;
      updatedByName: string | null;
    };
    pushover: {
      pushoverUserKey: string | null;
      pushoverEnabled: boolean;
      notifyNewBooking: boolean;
      notifyBookingPending: boolean;
      notifyBookingConfirmed: boolean;
      notifyBookingCancelled: boolean;
      notifyBookingRescheduled: boolean;
      notifyEmailFailed: boolean;
      notifyReminderFailed: boolean;
      notifySystemErrors: boolean;
    };
  };
}) {
  return (
    <AdminPageShell
      eyebrow="Provozní nastavení"
      title="Nastavení"
      description="Kontakty salonu, společná pravidla rezervací a základní provozní komunikace na jednom místě."
      stats={[
        {
          label: "Naposledy uložené",
          value: settings.updatedAt,
          tone: "accent",
          detail: "Změny se propisují do veřejných kontaktů, rezervací a potvrzovacích e-mailů.",
        },
      ]}
    >
      <section className="grid gap-3 rounded-[1.5rem] border border-white/8 bg-white/4 p-4 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <article className="rounded-[1.2rem] border border-white/8 bg-black/10 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Salon</p>
          <p className="mt-2 text-sm leading-6 text-white/72">Kontakty salonu a samostatné logo pro PDF vouchery.</p>
        </article>
        <article className="rounded-[1.2rem] border border-white/8 bg-black/10 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Rezervace</p>
          <p className="mt-2 text-sm leading-6 text-white/72">Předstih, horizont dopředu a storno limit.</p>
        </article>
        <article className="rounded-[1.2rem] border border-white/8 bg-black/10 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">E-maily</p>
          <p className="mt-2 text-sm leading-6 text-white/72">Upozornění, odesílatel a krátká patička.</p>
        </article>
        <article className="rounded-[1.2rem] border border-white/8 bg-black/10 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Kalendář</p>
          <p className="mt-2 text-sm leading-6 text-white/72">Chráněný Apple Calendar feed s potvrzenými rezervacemi.</p>
        </article>
      </section>

      <div className="grid gap-6">
        <AdminPanel
          title="Kontakty salonu"
          description="Veřejné kontakty pro web, e-maily a PDF voucher."
        >
          <AdminSalonSettingsForm settings={settings} />
        </AdminPanel>

        <AdminPanel
          title="Pravidla rezervací"
          description="Společná pravidla, která platí pro celý rezervační systém."
        >
          <AdminBookingSettingsForm settings={settings} />
        </AdminPanel>

        <AdminPanel
          title="E-mailová komunikace"
          description="Odesílatel, patička a základní provozní notifikace."
        >
          <AdminEmailSettingsForm settings={settings} />
        </AdminPanel>

        <AdminPanel
          title="Sdílený kalendář"
          description="Chráněný `.ics` feed pro Apple Kalendář a iCloud."
        >
          <AdminCalendarSettingsForm feed={settings.calendarFeed} />
        </AdminPanel>

        <AdminPanel
          title="Pushover upozornění"
          description="Owner-only upozornění na rezervace a provozní chyby."
        >
          <AdminPushoverSettingsForm settings={settings.pushover} />
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}
