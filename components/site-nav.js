"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Upload, FileText, Search, Inbox, Map, ChartNoAxesColumn, Settings } from "lucide-react";
import { Dock, DockItem } from "@/components/motion-primitives/dock";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { Logo } from "@/components/logo";

const LogoIcon = ({ size, strokeWidth, ...props }) => (
  <Logo size={size ? size - 2 : 16} {...props} />
);

const items = [
  { href: "/", label: "Home", Icon: LogoIcon },
  { href: "/upload", label: "Upload", Icon: Upload },
  { href: "/resume", label: "Resume studio", Icon: FileText },
  { href: "/jobs", label: "Jobs", Icon: Search },
  { href: "/queue", label: "Queue", Icon: Inbox },
  { href: "/roadmap", label: "Roadmap", Icon: Map },
  { href: "/stats", label: "Stats", Icon: ChartNoAxesColumn },
  { href: "/settings", label: "Settings", Icon: Settings },
];

/**
 * A visitor who has not signed in can only be on a public page, so the app
 * dock would be eight links that all bounce to /signin. They get a plain
 * marketing header instead: wordmark, theme toggle, one sign-in link.
 */
function MarketingHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="jobblast home">
          <Logo size={26} />
          <span className="font-display text-lg font-semibold">jobblast</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-muted transition hover:border-line hover:text-ink" />
          <Link
            href="/signin"
            className="rounded-xl px-3 py-2 text-sm font-medium text-ink transition hover:bg-accent-wash sm:px-4"
          >
            Sign in
          </Link>
          <Link
            href="/upload"
            className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-ink transition hover:bg-accent-hover sm:px-4"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Floating macOS-style dock, bottom-center, for someone using the app. */
function AppDock({ showAccount }) {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center">
      <Dock>
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <DockItem key={href}>
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                title={label}
                className={`flex h-full w-full items-center justify-center rounded-xl border transition ${
                  active
                    ? "border-line bg-accent-wash text-accent"
                    : "border-transparent text-muted hover:bg-accent-wash hover:text-ink"
                }`}
              >
                <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </DockItem>
          );
        })}
        <div className="mx-1 h-8 w-px self-center bg-line" aria-hidden="true" />
        <DockItem>
          <ThemeToggle className="flex h-full w-full items-center justify-center rounded-xl border border-transparent text-muted transition hover:bg-accent-wash hover:text-ink" />
        </DockItem>
        {showAccount && (
          <DockItem>
            <UserMenu />
          </DockItem>
        )}
      </Dock>
    </div>
  );
}

/**
 * Split out so `useSession` is only ever called under a SessionProvider —
 * local mode (auth disabled) never mounts one, and the hook throws there.
 */
function AuthAwareNav() {
  const { status } = useSession();

  // Still resolving: render nothing rather than flashing the marketing
  // header at someone who turns out to be signed in.
  if (status === "loading") return null;
  if (status !== "authenticated") return <MarketingHeader />;
  return <AppDock showAccount />;
}

// `authEnabled` comes from the server layout.
export function SiteNav({ authEnabled = false }) {
  const pathname = usePathname();

  // The sign-in screen is a clean full-page experience: no nav of any kind.
  if (pathname === "/signin") return null;

  return authEnabled ? <AuthAwareNav /> : <AppDock showAccount={false} />;
}
