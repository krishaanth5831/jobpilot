"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

// Theme (class-based b&w light/dark), auth session, and b&w toasts.
// Scrolling is native — scroll-hijacking libraries (Lenis) broke trackpad
// scrolling by capturing wheel events.
export function Providers({ children }) {
  return (
    <SessionProvider>
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
    </SessionProvider>
  );
}
