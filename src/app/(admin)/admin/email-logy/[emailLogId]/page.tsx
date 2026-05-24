import { notFound } from "next/navigation";

import { AdminEmailLogDetailPage } from "@/features/admin/components/admin-email-log-detail-page";
import { getEmailLogDetailData } from "@/features/admin/lib/admin-data";
import { requireAdminArea } from "@/lib/auth/session";

type AdminEmailLogDetailRouteProps = {
  params: Promise<{
    emailLogId: string;
  }>;
  searchParams: Promise<{
    flash?: string;
  }>;
};

export default async function AdminEmailLogDetailRoute({
  params,
  searchParams,
}: AdminEmailLogDetailRouteProps) {
  await requireAdminArea("owner");

  const { emailLogId } = await params;
  const { flash } = await searchParams;
  const data = await getEmailLogDetailData(emailLogId);

  if (!data) {
    notFound();
  }

  const flashMessage = getFlashMessage(flash);

  return <AdminEmailLogDetailPage data={data} flashMessage={flashMessage} />;
}

function getFlashMessage(flash?: string) {
  switch (flash) {
    case "retry-success":
      return "Ruční retry byl odeslaný do fronty. Worker ho zpracuje při dalším průchodu.";
    case "release-success":
      return "Zaseknutý job byl uvolněný a vrácený zpět do fronty.";
    case "recipient-refresh-success":
      return "Příjemce byl aktualizovaný podle aktuálního kontaktu klientky.";
    case "recipient-refresh-missing":
      return "U klientky není vyplněný e-mail, takže nebylo co načíst.";
    case "resend-success":
      return "Do fronty byl založený nový pokus o odeslání tohoto e-mailu.";
    case "resend-missing-recipient":
      return "Příjemce je prázdný. Nejdřív načtěte nebo doplňte e-mail kontaktu.";
    default:
      return undefined;
  }
}
