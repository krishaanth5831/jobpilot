"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/logo";

// Sign-in / sign-up screen. The primary method is email + password: the
// first tab creates an account, the other signs back in. Optional OAuth
// buttons (Google/GitHub/Microsoft) appear below only if configured.
// Shown by <AuthGate> on protected pages and by the /signin route.

// OAuth brand marks, inlined (the app's CSP forbids remote assets).
function ProviderIcon({ id }) {
  if (id === "google") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
      </svg>
    );
  }
  if (id === "microsoft-entra-id") {
    return (
      <svg width="17" height="17" viewBox="0 0 21 21" aria-hidden="true">
        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
        <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
        <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.4-1.27.74-1.56-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.2.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-700";

export function SignInCard({ providers = [], freeModel = false }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();

  // An influencer share link (/signin?ref=CODE) lands new visitors straight
  // on sign-up with their creator code already filled in.
  const refCode = params.get("ref") ?? "";
  const [mode, setMode] = useState(refCode ? "signup" : "signin"); // "signin" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creatorCode, setCreatorCode] = useState(refCode);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // "form" | provider id

  // Return to wherever they were. On /signin, honor ?callbackUrl or go home.
  const callbackUrl =
    params.get("callbackUrl") || (pathname === "/signin" ? "/" : pathname || "/");

  const isSignup = mode === "signup";

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy("form");
    try {
      if (isSignup) {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name, creatorCode }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Couldn't create your account.");
          setBusy(null);
          return;
        }
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(
          isSignup
            ? "Account created, but sign-in failed. Try signing in."
            : "Invalid email or password."
        );
        setBusy(null);
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-6 text-2xl font-bold tracking-tight">
            {isSignup ? "Create your account" : "Sign in to jobblast"}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Your resume, matches, and applications live in your account — sign
            in from any device and they&apos;re right there.
          </p>
          {isSignup && freeModel && (
            <p className="mt-3 rounded-xl border border-neutral-200 px-4 py-2.5 text-xs text-neutral-500 dark:border-neutral-800">
              New accounts include free built-in AI (Llama 3.3) — no API key
              needed. For noticeably better results, add your own Claude API
              key later in Settings.
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3">
          {isSignup && (
            <input
              type="text"
              autoComplete="name"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              aria-label="Name"
            />
          )}
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            aria-label="Email"
          />
          <input
            type="password"
            required
            minLength={isSignup ? 8 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "Password (8+ characters)" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            aria-label="Password"
          />
          {isSignup && (
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Creator code (optional)"
              value={creatorCode}
              onChange={(e) => setCreatorCode(e.target.value)}
              className={inputClass}
              aria-label="Creator code"
            />
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy !== null}
            className="mt-1 inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {busy === "form"
              ? isSignup
                ? "Creating account…"
                : "Signing in…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-500">
          {isSignup ? "Already have an account?" : "New to jobblast?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "signin" : "signup");
              setError(null);
            }}
            className="font-medium text-black underline underline-offset-2 dark:text-white"
          >
            {isSignup ? "Sign in" : "Create an account"}
          </button>
        </p>

        {providers.length > 0 && (
          <>
            <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
              or
              <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
            </div>
            <div className="flex flex-col gap-3">
              {providers.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setBusy(id);
                    signIn(id, { callbackUrl });
                  }}
                  disabled={busy !== null}
                  className="inline-flex items-center justify-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-900"
                >
                  <ProviderIcon id={id} />
                  {busy === id ? "Redirecting…" : `Continue with ${label}`}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
