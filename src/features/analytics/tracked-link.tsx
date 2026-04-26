"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { ObfuscatedEmailLink } from "@/components/ui/obfuscated-email-link";

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
  children: ReactNode;
};

type TrackedAnchorProps = ComponentPropsWithoutRef<"a"> & {
  tracking: Tracking;
};

function trackClick(tracking: Tracking) {
  if (tracking.kind === "reservation") {
    trackReservationCtaClick(tracking.location, tracking.page);
    return;
  }

  trackContactCtaClick(tracking.type, tracking.location);
}

export function TrackedLink({ tracking, children, ...props }: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={() => {
        trackClick(tracking);
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
