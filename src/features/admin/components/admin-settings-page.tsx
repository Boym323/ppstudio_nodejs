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
      description="Jedno klidné místo pro skutečně globální údaje salonu, booking pravidla a základní e-mailovou komunikaci. Správa služeb, slotů a rezervací zůstává ve vlastních modulech."
      stats={[
        {
          label: "Poslední úprava",
          value: settings.updatedAt,
          tone: "accent",
          detail: "Změny se propisují do veřejných kontaktů, bookingu a potvrzovacích e-mailů.",
        },
      ]}
    >
      <div className="grid gap-6">
        <AdminPanel
          title="Salon"
          description="Veřejné kontaktní údaje a identita salonu. Bez marketingového CMS a bez technických detailů navíc."
        >
          <AdminSalonSettingsForm settings={settings} />
        </AdminPanel>

        <AdminPanel
          title="Rezervace"
          description="Jen pravidla, která platí pro celý rezervační systém. Detailní provozní plánování patří dál do volných termínů."
        >
          <AdminBookingSettingsForm settings={settings} />
        </AdminPanel>

        <AdminPanel
          title="E-maily a notifikace"
          description="Základní komunikace směrem ke klientce a upozornění pro provoz. SMTP přístupové údaje zůstávají bezpečně mimo administraci."
        >
          <AdminEmailSettingsForm settings={settings} />
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}
