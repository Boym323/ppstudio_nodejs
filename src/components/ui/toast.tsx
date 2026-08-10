"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error";
type ToastInput = { message: string; tone?: ToastTone };
type ToastState = ToastInput & { id: number };

const ToastContext = createContext<{ toast: (input: ToastInput) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastState[]>([]);
  const toast = useCallback(({ message, tone = "success" }: ToastInput) => {
    const id = Date.now();
    setItems((current) => [...current.filter((item) => item.message !== message), { id, message, tone }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            open
            duration={item.tone === "success" ? 3200 : 6500}
            onOpenChange={(open) => {
              if (!open) setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
            }}
            className={cn(
              "pointer-events-auto flex w-full items-start gap-3 rounded-[1rem] border bg-[#17141b]/95 px-4 py-3 text-sm text-white shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur data-[state=open]:[animation:ppstudio-toast-in_180ms_ease-out] data-[state=closed]:[animation:ppstudio-toast-out_140ms_ease-in] motion-reduce:animate-none sm:max-w-sm",
              item.tone === "success" ? "border-emerald-300/20" : "border-red-300/30",
            )}
          >
            <ToastPrimitive.Title className={item.tone === "success" ? "text-emerald-300" : "text-red-300"}>
              {item.tone === "success" ? "Hotovo" : "Operaci se nepodařilo dokončit"}
            </ToastPrimitive.Title>
            <ToastPrimitive.Description className="min-w-0 flex-1 leading-5 text-white/86">
              {item.message}
            </ToastPrimitive.Description>
            <ToastPrimitive.Close aria-label="Zavřít oznámení" className="shrink-0 text-xs text-white/58 outline-none transition hover:text-white focus-visible:text-white focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60">
              Zavřít
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[110] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast musí být použito uvnitř ToastProvider.");
  return context;
}
