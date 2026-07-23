import { redirect } from "next/navigation";

export default function AdminEmailLogsRoute() {
  redirect("/admin/logy?view=emails");
}
