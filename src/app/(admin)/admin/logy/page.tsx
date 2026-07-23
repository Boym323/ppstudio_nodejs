import { AdminLogsPage } from "@/features/admin/components/admin-logs-page";
import { getAdminLogsData } from "@/features/admin/lib/admin-data";
import { requireAdminArea } from "@/lib/auth/session";

export default async function AdminLogsRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminArea("owner");
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  return <AdminLogsPage data={await getAdminLogsData({ area: "owner", view: value("view"), query: value("query"), severity: value("severity"), source: value("source"), dateFrom: value("dateFrom"), dateTo: value("dateTo"), page: value("page") })} />;
}
