import type { Metadata } from "next";

import { Container } from "@/components/ui/container";
import { CancellationPanel } from "@/features/booking/components/cancellation-panel";
import { getPublicCancellationPageState } from "@/features/booking/lib/booking-cancellation";

export const metadata: Metadata = {
  title: "Storno rezervace",
  description: "Bezpečné zrušení rezervace přes jednorázový token.",
  robots: {
    index: false,
    follow: false,
  },
};

type CancellationPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function CancellationPage({ params }: CancellationPageProps) {
  const { token } = await params;
  const state = await getPublicCancellationPageState(token);

  return (
    <div className="py-16 sm:py-20">
      <Container>
        <CancellationPanel token={token} initialState={state} />
      </Container>
    </div>
  );
}
