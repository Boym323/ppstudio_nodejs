"use client";

import { useId, useState, type ReactNode } from "react";

export function BookingPaymentTools({
  paymentForm,
  priceForm,
}: {
  paymentForm: ReactNode;
  priceForm: ReactNode;
}) {
  const id = useId();
  const [active, setActive] = useState<"payment" | "price" | null>(null);
  const tools = [
    { key: "payment", label: "Zapsat platbu", content: paymentForm },
    { key: "price", label: "Upravit cenu", content: priceForm },
  ] as const;

  if (!paymentForm && !priceForm) return null;

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {tools.map(({ key, label, content }) => content ? (
          <button
            key={key}
            id={`${id}-${key}-button`}
            type="button"
            aria-expanded={active === key}
            aria-controls={`${id}-${key}-panel`}
            onClick={() => setActive(active === key ? null : key)}
            className="flex min-h-11 items-center gap-2 rounded-[0.95rem] border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-sm font-medium text-white/78 transition hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <span aria-hidden="true">{active === key ? "▾" : "▸"}</span>
            {label}
          </button>
        ) : null)}
      </div>
      {tools.map(({ key, content }) => content ? (
        <div
          key={key}
          id={`${id}-${key}-panel`}
          role="region"
          aria-labelledby={`${id}-${key}-button`}
          hidden={active !== key}
          className="min-w-0 rounded-[0.95rem] border border-white/8 bg-black/14 p-3"
        >
          {content}
        </div>
      ) : null)}
    </div>
  );
}
