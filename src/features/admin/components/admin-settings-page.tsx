import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";

import { AdminBookingSettingsForm } from "./admin-booking-settings-form";
import { AdminEmailSettingsForm } from "./admin-email-settings-form";
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
    bookingMinAdvanceHours: number;
    bookingMaxAdvanceDays: number;
    bookingCancellationHours: number;
    notificationAdminEmail: string;
    emailSenderName: string;
    emailSenderEmail: string;
    emailFooterText: string | null;
    updatedAt: string;
  };
}) {
  return (
    <AdminPageShell
      eyebrow="Full Admin sekce"
      title="Nastavení"
      description="Jedno klidné místo pro veřejné kontakty salonu, globální pravidla rezervace a základní e-mailové odesílání. Nic pro služby, sloty ani jednotlivé rezervace."
      stats={[
        {
          label: "Naposledy uložené",
          value: settings.updatedAt,
          tone: "accent",
          detail: "Změny se propisují do veřejných kontaktů, rezervací a potvrzovacích e-mailů.",
        },
      ]}
    >
      <section className="grid gap-3 rounded-[1.5rem] border border-white/8 bg-white/4 p-4 sm:grid-cols-3 sm:gap-4">
        <article className="rounded-[1.2rem] border border-white/8 bg-black/10 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Salon</p>
          <p className="mt-2 text-sm leading-6 text-white/72">Název, adresa, telefon, e-mail a Instagram.</p>
        </article>
        <article className="rounded-[1.2rem] border border-white/8 bg-black/10 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Rezervace</p>
          <p className="mt-2 text-sm leading-6 text-white/72">Předstih, horizont dopředu a storno limit.</p>
        </article>
        <article className="rounded-[1.2rem] border border-white/8 bg-black/10 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">E-maily</p>
          <p className="mt-2 text-sm leading-6 text-white/72">Upozornění, odesílatel a krátká patička.</p>
        </article>
      </section>

      <div className="grid gap-6">
        <AdminPanel
          title="Salon"
          description="Veřejné kontaktní údaje pro web i e-maily."
        >
          <AdminSalonSettingsForm settings={settings} />
        </AdminPanel>

        <AdminPanel
          title="Rezervace"
          description="Jen společná pravidla pro celý rezervační systém."
        >
          <AdminBookingSettingsForm settings={settings} />
        </AdminPanel>

        <AdminPanel
          title="E-maily a notifikace"
          description="Základní komunikace směrem ke klientce a provozu."
        >
          <AdminEmailSettingsForm settings={settings} />
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}
