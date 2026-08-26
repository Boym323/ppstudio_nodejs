"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";

export const Root = DialogPrimitive.Root;
export const Trigger = DialogPrimitive.Trigger;
export const Close = DialogPrimitive.Close;

export const Portal = DialogPrimitive.Portal;

export const Overlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-[80] bg-black/62 backdrop-blur-sm data-[state=open]:[animation:ppstudio-overlay-in_180ms_ease-out] data-[state=closed]:[animation:ppstudio-overlay-out_140ms_ease-in] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
});

export const Content = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function DialogContent({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "admin-app fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[90] max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 overflow-y-auto text-[var(--color-admin-foreground)] [--color-accent-contrast:#fff] data-[state=open]:[animation:ppstudio-dialog-in_180ms_ease-out] data-[state=closed]:[animation:ppstudio-dialog-out_140ms_ease-in] motion-reduce:animate-none sm:top-1/2 sm:bottom-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[calc(100%-3rem)] sm:-translate-y-1/2",
        className,
      )}
      {...props}
    />
  );
});

export const Title = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("mt-2 text-2xl font-display text-white", className)}
      {...props}
    />
  );
});

export const Description = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("mt-2 text-sm leading-6 text-white/66", className)}
      {...props}
    />
  );
});
