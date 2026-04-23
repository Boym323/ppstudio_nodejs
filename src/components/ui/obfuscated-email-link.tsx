'use client';

import { formatObfuscatedEmail } from '@/lib/email-obfuscation';

type ObfuscatedEmailLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'children' | 'href'
> & {
  email: string;
  subject?: string;
  body?: string;
  children?: React.ReactNode;
  ariaLabel?: string;
};

function buildMailtoHref(email: string, subject?: string, body?: string) {
  const query = new URLSearchParams();

  if (subject) {
    query.set('subject', subject);
  }

  if (body) {
    query.set('body', body);
  }

  const queryString = query.toString();

  return queryString ? `mailto:${email}?${queryString}` : `mailto:${email}`;
}

export function ObfuscatedEmailLink({
  email,
  subject,
  body,
  onClick,
  ariaLabel,
  children,
  ...props
}: ObfuscatedEmailLinkProps) {
  const mailtoHref = buildMailtoHref(email, subject, body);
  const href = typeof window === 'undefined' ? '#' : mailtoHref;

  return (
    <a
      {...props}
      href={href}
      suppressHydrationWarning
      aria-label={ariaLabel ?? 'Napsat e-mail'}
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented) {
          return;
        }

        if (href === '#') {
          event.preventDefault();
          window.location.href = mailtoHref;
        }
      }}
    >
      {children ?? formatObfuscatedEmail(email)}
    </a>
  );
}
