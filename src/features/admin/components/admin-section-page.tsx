import { type AdminArea, type AdminSectionSlug } from "@/config/navigation";

import {
  getAdminSectionData,
  getAdminSectionTitle,
  type EmailLogsDashboardData,
  type ReservationsDashboardData,
} from "../lib/admin-data";
import { AdminBookingsPage } from "./admin-bookings-page";
import { AdminEmailLogsPage } from "./admin-email-logs-page";
import { AdminKeyValueList, AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminSectionPageProps = {
  area: AdminArea;
  section: Exclude<AdminSectionSlug, "overview">;
};

export async function AdminSectionPage({
  area,
  section,
}: AdminSectionPageProps) {
  const data = await getAdminSectionData(section, area);

  if (section === "email-logy" && area === "owner") {
    return <AdminEmailLogsPage area={area} data={data as EmailLogsDashboardData} />;
  }

  if (section === "rezervace") {
    return <AdminBookingsPage area={area} data={data as ReservationsDashboardData} />;
  }

  const title = getAdminSectionTitle(section);

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Full Admin sekce" : "Provozní sekce"}
      title={title}
      description={getSectionDescription(section, area)}
      stats={"stats" in data ? data.stats : undefined}
      compact={area === "salon"}
    >
      <AdminPanel
        title={getPanelTitle(section, area)}
        description={getPanelDescription(section, area)}
        compact={area === "salon"}
      >
        <AdminKeyValueList
          items={"items" in data ? data.items : []}
          emptyTitle={`Sekce ${title.toLowerCase()} je zatím prázdná.`}
          emptyDescription={getEmptyDescription(section, area)}
        />
      </AdminPanel>
    </AdminPageShell>
  );
}

function getSectionDescription(section: Exclude<AdminSectionSlug, "overview">, area: AdminArea) {
  const owner = area === "owner";

  switch (section) {
    case "rezervace":
      return owner
        ? "Plný přehled nad stavem rezervací, zdroji bookingu a provozní prioritou dalších kroků."
        : "Rychlý provozní seznam rezervací pro potvrzení, telefonát nebo obsluhu klientky.";
    case "volne-terminy":
      return owner
        ? "Ruční správa publikovaných slotů a kontrola kapacity pro veřejné rezervační flow."
        : "Jednoduchý přehled volných termínů bez technických detailů navíc.";
    case "klienti":
      return owner
        ? "Historie klientely, aktivita a kontext pro vztah se salonem i reporting."
        : "Praktický adresář klientek pro běžný provoz, komunikaci a orientaci v historii.";
    case "certifikaty":
      return owner
        ? "Správa certifikátů publikovaných na veřejné stránce O mně."
        : "Rychlý přístup k certifikátům viditelným na webu.";
    case "sluzby":
      return owner
        ? "Katalog služeb pro web, ceník i booking logiku včetně cen, délek a publikace."
        : "Základní orientace v nabídce služeb, aby provoz rychle věděl délku a cenu.";
    case "kategorie-sluzeb":
      return owner
        ? "Struktura nabídky, která určuje přehlednost katalogu i veřejného webu."
        : "Lehký přehled kategorií, ve kterých se provoz může snadno orientovat.";
    case "uzivatele":
      return "Sekce pouze pro majitele: přehled přístupů, rolí a stavu účtů.";
    case "email-logy":
      return "Sekce pouze pro majitele: audit e-mailové komunikace, selhání a provozních incidentů.";
    case "nastaveni":
      return "Sekce pouze pro majitele: serverově spravované hodnoty a provozní konfigurace aplikace.";
  }
}

function getPanelTitle(section: Exclude<AdminSectionSlug, "overview">, area: AdminArea) {
  if (area === "salon") {
    switch (section) {
      case "rezervace":
        return "Termíny k obsluze";
      case "volne-terminy":
        return "Připravené sloty";
      case "klienti":
        return "Klientská karta";
      case "certifikaty":
        return "Certifikace";
      case "sluzby":
        return "Aktuální nabídka";
      case "kategorie-sluzeb":
        return "Rozdělení služeb";
      case "uzivatele":
      case "email-logy":
      case "nastaveni":
        return "Detail sekce";
    }
  }

  return "Přehled dat";
}

function getPanelDescription(section: Exclude<AdminSectionSlug, "overview">, area: AdminArea) {
  if (area === "salon") {
    return "Záměrně jednoduché UI pro rychlé čtení na mobilu i za provozu.";
  }

  switch (section) {
    case "uzivatele":
      return "Přístupy jsou zobrazené lidským jazykem včetně role, stavu a dostupných akcí.";
    case "email-logy":
      return "Pomáhá odhalit problémy v potvrzovacích e-mailech dřív, než je pocítí klientka.";
    case "certifikaty":
      return "Certifikáty jsou uložené lokálně mimo repo a metadata zůstávají v databázi.";
    case "nastaveni":
      return "Read model pro serverová nastavení. Změnové formuláře lze doplnit v navazující iteraci bez přestavby struktury.";
    default:
      return "Sekce je navržená pro přehled, rychlost a čistý provozní kontext bez generického CMS chaosu.";
  }
}

function getEmptyDescription(section: Exclude<AdminSectionSlug, "overview">, area: AdminArea) {
  if (area === "salon") {
    return "Až budou v databázi reálná provozní data, zobrazí se tady bez dalších úprav navigace.";
  }

  switch (section) {
    case "uzivatele":
      return "Pokud ještě nejsou založené běžné účty, zůstanou tu přehledně vidět systémové přístupy.";
    case "email-logy":
      return "Email logy se založí při navázání nebo odeslání notifikačního workflow.";
    case "certifikaty":
      return "Nahrajte první certifikát a sekce se hned propše i na veřejnou stránku O mně.";
    case "nastaveni":
      return "Jakmile aplikace začne ukládat serverově spravované hodnoty do tabulky Setting, objeví se zde.";
    default:
      return "Sekce je připravená na reálná data bez nutnosti přegenerovávat demo obsah.";
  }
}
