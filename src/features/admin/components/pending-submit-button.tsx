'use client';

import { type ButtonHTMLAttributes } from 'react';
import { useFormStatus } from 'react-dom';

type PendingSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel: string;
};

export function PendingSubmitButton({ children, pendingLabel, disabled, ...props }: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return <button {...props} type="submit" disabled={disabled || pending} aria-busy={pending}>{pending ? pendingLabel : children}</button>;
}
