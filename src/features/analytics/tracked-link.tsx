"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { ObfuscatedEmailLink } from "@/components/ui/obfuscated-email-link";

import { trackContactCtaClick } from "./matomo";

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
  if (tracking.kind === "contact") trackContactCtaClick(tracking.type, tracking.location);
}

function getBookingEntrySource(tracking: Extract<Tracking, { kind: "reservation" }>, href: string) {
  const source = href.includes("service=") || tracking.page === "služby"
    ? "service_detail"
    : tracking.page === "cenik"
      ? "price_list"
      : tracking.page === "domů" || tracking.page === "kosmetika zlín"
        ? "homepage"
        : tracking.page === "dárkové vouchery"
          ? "voucher"
          : "other";

  const url = new URL(href, "https://ppstudio.local");
  url.searchParams.set("source", source);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function TrackedLink({ tracking, children, ...props }: TrackedLinkProps) {
  const prefetch = props.prefetch ?? (tracking.kind === "reservation" ? false : undefined);
  const href = tracking.kind === "reservation" ? getBookingEntrySource(tracking, props.href) : props.href;

  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch}
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
