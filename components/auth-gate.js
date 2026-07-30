"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { SignInCard } from "@/components/sign-in-card";
import { Logo } from "@/components/logo";

// When auth is enabled, the app requires a signed-in user. Public exceptions:
// the landing page (it is the marketing page, so gating it means nobody can
// read what jobblast does before creating an account), /signin itself (it
// would gate itself), the no-account ATS teaser at /check, the pricing page
// (asking someone to make an account before they can see the price is the
// fastest way to lose them), and the password reset flow at /reset. Local mode
// never mounts this.
const PUBLIC = new Set(["/", "/signin", "/check", "/pricing", "/reset"]);

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
