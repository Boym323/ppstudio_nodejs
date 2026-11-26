"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { ObfuscatedEmailLink } from "@/components/ui/obfuscated-email-link";
import { buildBookingEntryHref } from "@/features/booking/lib/booking-entry-source";

import { getMatomoPageLabel, trackContactCtaClick, trackReservationCtaClick } from "./matomo";

type Tracking =
  | {
      kind: "reservation";
      location: string;
      page?: string;
      detail?: string;
    }
  | {
      kind: "contact";
      type: "phone" | "email" | "instagram" | "contact form" | "map";
      location: string;
    };

type TrackedLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "onClick"> & {
  href: string;
  tracking: Tracking;
  children: ReactNode;
};

type TrackedAnchorProps = ComponentPropsWithoutRef<"a"> & {
  tracking: Tracking;
};

function trackClick(tracking: Tracking) {
  if (tracking.kind === "contact") trackContactCtaClick(tracking.type, tracking.location);
}

export function TrackedLink({ tracking, children, ...props }: TrackedLinkProps) {
  const pathname = usePathname();
  const reservation = tracking.kind === "reservation";
  const page = reservation ? tracking.page ?? getMatomoPageLabel(pathname) : "";
  const prefetch = props.prefetch ?? (reservation ? false : undefined);
  const href = reservation ? buildBookingEntryHref(props.href, page) : props.href;
  const trackActivation = () => {
    if (reservation) {
      trackReservationCtaClick(tracking.location, page, tracking.detail);
    } else {
      trackClick(tracking);
    }
  };

  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch}
      onClick={trackActivation}
      onAuxClick={(event) => {
        props.onAuxClick?.(event);
        if (!event.defaultPrevented && event.button === 1 && reservation) trackActivation();
      }}
    >
      {children}
    </Link>
  );
}

export function TrackedAnchor({ tracking, children, onClick, ...props }: TrackedAnchorProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        trackClick(tracking);
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}

type TrackedEmailLinkProps = Omit<ComponentPropsWithoutRef<typeof ObfuscatedEmailLink>, "onClick"> & {
  tracking: Extract<Tracking, { kind: "contact" }>;
};

export function TrackedEmailLink({ tracking, children, ...props }: TrackedEmailLinkProps) {
  return (
    <ObfuscatedEmailLink
      {...props}
      onClick={() => {
        trackClick(tracking);
      }}
    >
      {children}
    </ObfuscatedEmailLink>
  );
}
