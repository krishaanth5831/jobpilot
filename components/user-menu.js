"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";

// Dock button for accounts. Only rendered when auth providers are
// configured (see lib/auth.js) — in local mode there's nothing to sign
// in to. Signed out: a sign-in button (Auth.js shows the provider list).
// Signed in: the user's avatar; clicking it signs out.
export function UserMenu() {
  const { data: session, status } = useSession();
  const [busy, setBusy] = useState(false);

  if (status === "loading") {
    return <span className="flex h-full w-full items-center justify-center" aria-hidden="true" />;
  }

  if (!session?.user) {
    return (
      <button
        type="button"
        onClick={() => {
          setBusy(true);
          signIn();
        }}
        disabled={busy}
        aria-label="Sign in"
        title="Sign in"
        className="flex h-full w-full items-center justify-center rounded-xl border border-transparent transition hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-900"
      >
        <LogIn size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
    );
  }

  const initial = (session.user.name ?? session.user.email ?? "?").slice(0, 1).toUpperCase();
  return (
    <button
      type="button"
      onClick={() => {
        setBusy(true);
        signOut();
      }}
      disabled={busy}
      aria-label={`Signed in as ${session.user.email} — sign out`}
      title={`${session.user.email} — click to sign out`}
      className="group relative flex h-full w-full items-center justify-center rounded-xl border border-transparent transition hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-900"
    >
      {session.user.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- external avatar host varies by provider
        <img
          src={session.user.image}
          alt=""
          width={22}
          height={22}
          className="rounded-full group-hover:hidden"
        />
      ) : (
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black font-mono text-[11px] text-white group-hover:hidden dark:bg-white dark:text-black">
          {initial}
        </span>
      )}
      <LogOut size={16} strokeWidth={1.5} className="hidden group-hover:block" aria-hidden="true" />
    </button>
  );
}
