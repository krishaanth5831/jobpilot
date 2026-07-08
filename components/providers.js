"use client";

import { ThemeProvider } from "next-themes";
import { ReactLenis } from "lenis/react";
import { Toaster } from "sonner";
import { useMounted, useMediaQuery } from "@/components/use-mounted";

// Theme (class-based b&w light/dark), smooth scrolling, and b&w toasts.
export function Providers({ children }) {
  const mounted = useMounted();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
  const smoothScroll = mounted && !reducedMotion;

  const content = (
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

  return smoothScroll ? (
    <ReactLenis root options={{ lerp: 0.12 }}>
      {content}
    </ReactLenis>
  ) : (
    content
  );
}
