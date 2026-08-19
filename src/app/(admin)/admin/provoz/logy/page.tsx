import { AdminLogsPage } from "@/features/admin/components/admin-logs-page";
import { getAdminLogsData } from "@/features/admin/lib/data/email-logs";
import { requireAdminArea } from "@/lib/auth/session";

export default async function SalonLogsRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminArea("salon");
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  return <AdminLogsPage data={await getAdminLogsData({ area: "salon", view: value("view"), query: value("query"), severity: value("severity"), source: value("source"), emailType: value("emailType"), dateFrom: value("dateFrom"), dateTo: value("dateTo"), page: value("page") })} />;
}
