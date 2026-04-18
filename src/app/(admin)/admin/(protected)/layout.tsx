import { AdminShell } from "@/components/layout/admin-shell";
import { requireSession } from "@/lib/auth/session";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();

  return (
    <AdminShell currentRole={session.role} userName={session.name}>
      {children}
    </AdminShell>
  );
}
