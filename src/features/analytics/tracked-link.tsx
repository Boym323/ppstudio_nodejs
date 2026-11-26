"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { ObfuscatedEmailLink } from "@/components/ui/obfuscated-email-link";
import { buildBookingEntryHref } from "@/features/booking/lib/booking-entry-source";

import { trackContactCtaClick, trackReservationCtaClick } from "./matomo";

type Tracking =
  | {
      kind: "reservation";
      location: string;
      page: string;
    }
  | {
      kind: "contact";
      type: "phone" | "email" | "instagram" | "contact form" | "map";
      location: string;
    };

type TrackedLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "onClick"> & {
  href: string;
  tracking: Tracking;
  trackReservationClick?: boolean;
  children: ReactNode;
};

type TrackedAnchorProps = ComponentPropsWithoutRef<"a"> & {
  tracking: Tracking;
};

function trackClick(tracking: Tracking) {
  if (tracking.kind === "contact") trackContactCtaClick(tracking.type, tracking.location);
}

function getBookingHref(tracking: Extract<Tracking, { kind: "reservation" }>, href: string) {
  return buildBookingEntryHref(href, tracking.page);
}

export function TrackedLink({ tracking, trackReservationClick = false, children, ...props }: TrackedLinkProps) {
  const prefetch = props.prefetch ?? (tracking.kind === "reservation" ? false : undefined);
  const href = tracking.kind === "reservation" ? getBookingHref(tracking, props.href) : props.href;

  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch}
      onClick={() => {
        trackClick(tracking);
        if (tracking.kind === "reservation" && trackReservationClick) {
          trackReservationCtaClick(tracking.location);
        }
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
