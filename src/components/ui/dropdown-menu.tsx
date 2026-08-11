"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";

export const Root = DropdownMenuPrimitive.Root;
export const Trigger = DropdownMenuPrimitive.Trigger;
export const Portal = DropdownMenuPrimitive.Portal;
export const Group = DropdownMenuPrimitive.Group;
export const Separator = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return <DropdownMenuPrimitive.Separator ref={ref} className={cn("my-1 h-px bg-white/10", className)} {...props} />;
});

export const Content = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "admin-app z-[100] min-w-56 rounded-[1rem] border border-white/10 bg-[#171419] p-1.5 text-white shadow-[0_18px_40px_rgba(0,0,0,0.35)] outline-none data-[state=open]:[animation:ppstudio-menu-in_140ms_ease-out] data-[state=closed]:[animation:ppstudio-menu-out_100ms_ease-in] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
});

export const Item = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(function DropdownMenuItem({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "flex min-h-10 w-full cursor-pointer select-none items-center rounded-[0.75rem] px-3 text-left text-sm text-white/84 outline-none transition data-[highlighted]:bg-white/8 data-[highlighted]:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        className,
      )}
      {...props}
    />
  );
});
