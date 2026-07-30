"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";

// Minimal footer. Deliberately no invented office address, no social links
// that do not exist, and no "company" boilerplate: one person builds this.
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={22} />
          <span className="font-display text-base font-semibold">jobblast</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/check" className="transition hover:text-ink">
            Free resume check
          </Link>
          <Link href="/pricing" className="transition hover:text-ink">
            Pricing
          </Link>
          <Link href="/signin" className="transition hover:text-ink">
            Sign in
          </Link>
          <Link href="/upload" className="transition hover:text-ink">
            Get started
          </Link>
        </nav>
      </div>
    </footer>
  );
}
