import type { Metadata } from "next";

import { Container } from "@/components/ui/container";
import { BookingManagementPanel } from "@/features/booking/components/booking-management-panel";
import { getPublicBookingManagementPageState } from "@/features/booking/lib/booking-management";
import { getPublicSalonProfile } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Správa rezervace",
  description: "Bezpečná změna termínu rezervace přes chráněný odkaz.",
  robots: {
    index: false,
    follow: false,
  },
};

type BookingManagementPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function BookingManagementPage({
  params,
}: BookingManagementPageProps) {
  const { token } = await params;
  const [state, salonProfile] = await Promise.all([
    getPublicBookingManagementPageState(token),
    getPublicSalonProfile(),
  ]);

  return (
    <div className="py-16 sm:py-20">
      <Container>
        <BookingManagementPanel
          token={token}
          initialState={state}
          salonContact={{
            email: salonProfile.email,
            phone: salonProfile.phone,
          }}
        />
      </Container>
    </div>
  );
}
