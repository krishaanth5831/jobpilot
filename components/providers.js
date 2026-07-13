"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { AuthGate } from "@/components/auth-gate";

// Theme (class-based b&w light/dark), auth session, and b&w toasts.
// Scrolling is native — scroll-hijacking libraries (Lenis) broke trackpad
// scrolling by capturing wheel events.
//
// SessionProvider fetches /api/auth/session on mount. In local mode (no
// providers) that endpoint has nothing to serve, so we only mount it — and
// the sign-in gate — when auth is actually enabled. ThemeProvider/Toaster
// always wrap so the sign-in screen is themed and toasts work everywhere.
export function Providers({ children, authEnabled = false, providers = [] }) {
  const themed = (content) => (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {content}
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

  if (!authEnabled) return themed(children);

  return (
    <SessionProvider>
      {themed(<AuthGate providers={providers}>{children}</AuthGate>)}
    </SessionProvider>
  );
}
