'use client';

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

  return (
    <a
      {...props}
      href={mailtoHref}
      aria-label={ariaLabel ?? 'Napsat e-mail'}
      onClick={(event) => {
        onClick?.(event);
      }}
    >
      {children ?? email}
    </a>
  );
}
