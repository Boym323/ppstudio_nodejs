"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import * as Dialog from "./dialog";
import { cn } from "@/lib/utils";

export const Root = Dialog.Root;
export const Trigger = Dialog.Trigger;
export const Close = Dialog.Close;
export const Title = Dialog.Title;
export const Description = Dialog.Description;

type SheetContentProps = ComponentPropsWithoutRef<typeof Dialog.Content> & {
  overlayClassName?: string;
  side?: "bottom" | "left";
};

/** Tenký Dialog wrapper pro mobilní bottom a left sheets. */
export const Content = forwardRef<
  ElementRef<typeof Dialog.Content>,
  SheetContentProps
>(function SheetContent({ className, overlayClassName, side = "bottom", ...props }, ref) {
  const isLeft = side === "left";

  return (
    <Dialog.Portal>
      <Dialog.Overlay
        className={cn(
          "z-50 bg-black/65 backdrop-blur-sm data-[state=open]:[animation:ppstudio-sheet-overlay-in_200ms_ease-out] data-[state=closed]:[animation:ppstudio-sheet-overlay-out_160ms_ease-in] motion-reduce:animate-none",
          overlayClassName,
        )}
      />
      <Dialog.Content
        ref={ref}
        className={cn(
          "z-50 flex !max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] !w-full !max-w-none !translate-x-0 !translate-y-0 flex-col overflow-y-auto overscroll-contain bg-[#111015] shadow-[0_-16px_40px_rgba(0,0,0,0.35)] motion-reduce:animate-none sm:!top-auto sm:!bottom-0 sm:!max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] sm:!w-full sm:!translate-y-0",
          isLeft
            ? "!inset-y-0 !left-0 !h-[100dvh] !max-h-none !w-[min(92vw,360px)] rounded-none border-r border-white/10 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] shadow-[0_18px_48px_rgba(0,0,0,0.35)] sm:!inset-y-0 sm:!left-0 sm:!h-[100dvh] sm:!max-h-none sm:!w-[min(92vw,360px)] data-[state=open]:[animation:ppstudio-sheet-slide-right_220ms_cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:[animation:ppstudio-sheet-slide-left_160ms_ease-in]"
            : "!inset-x-0 !bottom-0 rounded-t-[1.6rem] border border-white/10 px-4 pt-4 data-[state=open]:[animation:ppstudio-sheet-slide-up_220ms_cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:[animation:ppstudio-sheet-slide-down_160ms_ease-in]",
          className,
        )}
        {...props}
      />
    </Dialog.Portal>
  );
});
