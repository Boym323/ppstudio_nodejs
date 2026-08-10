"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";

export const Root = AlertDialogPrimitive.Root;
export const Trigger = AlertDialogPrimitive.Trigger;
export const Portal = AlertDialogPrimitive.Portal;
export const Action = AlertDialogPrimitive.Action;
export const Cancel = AlertDialogPrimitive.Cancel;

export const Overlay = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(function AlertDialogOverlay({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm", className)}
      {...props}
    />
  );
});

export const Content = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(function AlertDialogContent({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-3rem)] sm:-translate-y-1/2",
        className,
      )}
      {...props}
    />
  );
});

export const Title = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(function AlertDialogTitle({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Title
      ref={ref}
      className={cn("text-2xl font-display text-white", className)}
      {...props}
    />
  );
});

export const Description = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(function AlertDialogDescription({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Description
      ref={ref}
      className={cn("mt-2 text-sm leading-6 text-white/66", className)}
      {...props}
    />
  );
});
