/**
 * Re-exports sonner's toast API. Centralized so we can swap underlying
 * library later without touching the 30+ call sites. The brand styling
 * itself is wired in components/ui/sonner.tsx (toastOptions.classNames)
 * and goes through the global <Toaster /> mounted in app/layout.tsx.
 */
export { toast } from 'sonner';
