import type { Metadata } from "next";

import { AdminRole } from "@prisma/client";

import { AdminInviteActivationForm } from "@/features/admin/components/admin-invite-activation-form";
import { getAdminInvitePageState } from "@/features/admin/lib/admin-invite";

export const metadata: Metadata = {
  title: "Aktivace přístupu",
  description: "Dokončení pozvánky do administrace PP Studio.",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminInvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

function roleLabel(role: AdminRole) {
  return role === AdminRole.OWNER ? "OWNER" : "SALON";
}

function StateCard({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-[var(--radius-panel)] border border-white/10 bg-white/6 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.35em] text-[var(--color-accent-soft)]">
        Pozvánka do administrace
      </p>
      <h1 className="mt-4 font-display text-4xl text-white">{title}</h1>
      <p className="mt-4 text-sm leading-6 text-white/72">{description}</p>
    </section>
  );
}

export default async function AdminInvitePage({ params }: AdminInvitePageProps) {
  const { token } = await params;
  const inviteState = await getAdminInvitePageState(token);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(190,160,120,0.18),transparent_28%),linear-gradient(160deg,#111111_0%,#1b1714_45%,#281f19_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-5 py-16 sm:px-6">
        {inviteState.status === "ready" ? (
          <AdminInviteActivationForm
            token={token}
            userName={inviteState.userName}
            userEmail={inviteState.userEmail}
            roleLabel={roleLabel(inviteState.role)}
          />
        ) : (
          <StateCard title="Pozvánka není aktivní" description={inviteState.message} />
        )}
      </div>
    </div>
  );
}
