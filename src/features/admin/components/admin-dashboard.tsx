import { AdminRole } from "@prisma/client";

type AdminDashboardProps = {
  role: AdminRole;
  title: string;
  description: string;
  cards: Array<{
    title: string;
    body: string;
  }>;
};

export function AdminDashboard({
  role,
  title,
  description,
  cards,
}: AdminDashboardProps) {
  return (
    <>
      <section className="rounded-[var(--radius-panel)] border border-white/10 bg-white/6 p-7 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--color-accent-soft)]">
          {role === AdminRole.OWNER ? "Owner dashboard" : "Provozní dashboard"}
        </p>
        <h2 className="mt-4 font-display text-5xl text-white">{title}</h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-white/72">{description}</p>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-[var(--radius-panel)] border border-white/10 bg-black/10 p-6"
          >
            <h3 className="font-display text-3xl text-white">{card.title}</h3>
            <p className="mt-4 text-sm leading-6 text-white/68">{card.body}</p>
          </article>
        ))}
      </section>
    </>
  );
}
