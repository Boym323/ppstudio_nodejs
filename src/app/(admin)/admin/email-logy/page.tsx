import { AdminEmailLogsPage } from "@/features/admin/components/admin-email-logs-page";
import { getEmailLogsData } from "@/features/admin/lib/admin-data";
import { requireAdminArea } from "@/lib/auth/session";

export default async function AdminEmailLogsRoute() {
  await requireAdminArea("owner");
  const data = await getEmailLogsData();

  return <AdminEmailLogsPage area="owner" data={data} />;
}
