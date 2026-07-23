"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-700";

export function ResetClient() {
  const token = useSearchParams().get("token");
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo size={44} />
          {token ? <NewPasswordForm token={token} /> : <RequestForm />}
        </div>
      </div>
    </div>
  );
}

// Step 1 — ask for the email, always respond the same way (the API never
// reveals whether an account exists).
function RequestForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-neutral-500">
          If an account exists for <span className="font-medium">{email}</span>,
          a reset link is on its way. The link works for one hour — check spam
          if it doesn&apos;t arrive.
        </p>
        <Link
          href="/signin"
          className="mt-6 text-sm font-medium underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Enter your account&apos;s email and we&apos;ll send you a link to set a
        new password.
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex w-full flex-col gap-3">
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
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-1 inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy ? "Sending…" : "Email me a reset link"}
        </button>
      </form>
      <Link
        href="/signin"
        className="mt-4 text-sm text-neutral-500 underline underline-offset-2"
      >
        Back to sign in
      </Link>
    </>
  );
}

// Step 2 — arrived from the email link: set the new password.
function NewPasswordForm({ token }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Password updated</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Your new password is set — sign in with it now.
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black"
        >
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Set a new password</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Choose a new password for your account (8+ characters).
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex w-full flex-col gap-3">
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="New password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          aria-label="New password"
        />
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-1 inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy ? "Saving…" : "Set new password"}
        </button>
      </form>
    </>
  );
}
