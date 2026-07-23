"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { SignInCard } from "@/components/sign-in-card";
import { Logo } from "@/components/logo";

// When auth is enabled, everything requires a signed-in user — a logged-out
// visitor lands straight on the sign-in screen. Public exceptions: /signin
// itself (it would gate itself), the no-account ATS teaser at /check, and
// the password reset flow at /reset. Local mode never mounts this.
const PUBLIC = new Set(["/signin", "/check", "/reset"]);

export function AuthGate({ children, providers = [], freeModel = false }) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // A signed-in user has no reason to sit on the sign-in screen.
  useEffect(() => {
    if (status === "authenticated" && pathname === "/signin") {
      router.replace("/");
    }
  }, [status, pathname, router]);

  if (PUBLIC.has(pathname)) return children;
  if (status === "authenticated") return children;
  if (status === "loading") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Logo size={40} />
      </div>
    );
  }
  return <SignInCard providers={providers} freeModel={freeModel} />;
}
