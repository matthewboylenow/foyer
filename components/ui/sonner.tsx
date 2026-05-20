"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircle2, Info, AlertTriangle, XCircle, Loader2 } from "lucide-react"

// Branded Foyer Toaster — parish palette (cream / navy / rust / gold).
// All toast variants share a cream surface with a colored accent stripe on
// the left, serif title, sans body. Wired by app/layout.tsx.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      icons={{
        success: <CheckCircle2 className="size-4 text-gold" strokeWidth={2.25} />,
        info: <Info className="size-4 text-navy" strokeWidth={2.25} />,
        warning: <AlertTriangle className="size-4 text-rust" strokeWidth={2.25} />,
        error: <XCircle className="size-4 text-rust" strokeWidth={2.25} />,
        loading: <Loader2 className="size-4 animate-spin text-navy" />,
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "foyer-toast group/toast pointer-events-auto relative flex items-start gap-3 w-full p-4 pr-5 rounded-lg border border-navy/15 bg-cream text-navy shadow-lg shadow-navy/10 overflow-hidden",
          title: "font-serif text-[15px] font-semibold leading-snug text-navy",
          description: "text-[13px] text-navy/70 leading-snug mt-0.5",
          actionButton:
            "px-3 py-1 rounded-md bg-rust text-cream text-xs font-medium hover:bg-rust-700 transition-colors",
          cancelButton:
            "px-3 py-1 rounded-md bg-navy/5 text-navy text-xs font-medium hover:bg-navy/10 transition-colors",
          closeButton:
            "absolute top-2 right-2 size-5 rounded-md text-navy/40 hover:text-navy hover:bg-navy/5 grid place-items-center",
          icon: "shrink-0 mt-0.5",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
