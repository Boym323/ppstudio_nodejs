import { redirect } from "next/navigation";

import { getAdminHomeHref } from "@/config/navigation";
import { AdminLoginForm } from "@/features/admin/components/admin-login-form";
import { getSession } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    invite?: string;
  }>;
};

const errorMap: Record<string, string> = {
  invalid_credentials: "Zadané přihlašovací údaje nejsou správné.",
  invalid_payload: "Vyplň prosím korektně e-mail i heslo.",
  rate_limited: "Příliš mnoho pokusů o přihlášení. Zkuste to prosím za chvíli znovu.",
};

const infoMap: Record<string, string> = {
  activated: "Heslo je nastavené. Teď se můžete přihlásit.",
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();

  if (session) {
    redirect(getAdminHomeHref(session.role));
  }

  const params = await searchParams;
  const errorMessage = params.error ? errorMap[params.error] : undefined;
  const infoMessage = params.invite ? infoMap[params.invite] : undefined;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(190,160,120,0.18),transparent_28%),linear-gradient(160deg,#111111_0%,#1b1714_45%,#281f19_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-5 py-16 sm:px-6">
        <AdminLoginForm errorMessage={errorMessage} infoMessage={infoMessage} />
      </div>
    </div>
  );
}
