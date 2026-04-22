import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/ui/container";
import { BookingEmailActionPanel } from "@/features/booking/components/booking-email-action-panel";
import type { BookingEmailActionIntent } from "@/features/booking/lib/booking-action-tokens";
import { getBookingEmailActionPageState } from "@/features/booking/lib/booking-email-actions";

export const metadata: Metadata = {
  title: "Zpracování rezervace",
  description: "Bezpečné potvrzení nebo zrušení rezervace z provozního e-mailu.",
  robots: {
    index: false,
    follow: false,
  },
};

type BookingEmailActionPageProps = {
  params: Promise<{
    intent: string;
    token: string;
  }>;
};

function isIntent(value: string): value is BookingEmailActionIntent {
  return value === "approve" || value === "reject";
}

export default async function BookingEmailActionPage({ params }: BookingEmailActionPageProps) {
  const { intent, token } = await params;

  if (!isIntent(intent)) {
    notFound();
  }

  const state = await getBookingEmailActionPageState(intent, token);

  return (
    <div className="py-16 sm:py-20">
      <Container>
        <BookingEmailActionPanel token={token} intent={intent} initialState={state} />
      </Container>
    </div>
  );
}
