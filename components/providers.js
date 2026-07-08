"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import Lenis from "lenis";
import { Toaster } from "sonner";
import { useMediaQuery } from "@/components/use-mounted";

// Theme (class-based b&w light/dark), smooth scrolling, and b&w toasts.
// Lenis runs imperatively in an effect (not as a wrapper component) so the
// tree never re-parents after hydration — re-parenting remounts
// next-themes' inline theme script on the client, which React rejects.
export function Providers({ children }) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);

  useEffect(() => {
    if (reducedMotion) return;
    const lenis = new Lenis({ lerp: 0.12, autoRaf: true });
    return () => lenis.destroy();
  }, [reducedMotion]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
      <Toaster
        position="bottom-center"
        offset={88}
        toastOptions={{
          classNames: {
            toast:
              "!rounded-xl !border !border-neutral-200 !bg-white !text-black dark:!border-neutral-800 dark:!bg-neutral-950 dark:!text-white",
          },
        }}
      />
    </ThemeProvider>
  );
}
