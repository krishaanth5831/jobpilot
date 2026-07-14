"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Upload, FileText, Search, Inbox, Map, ChartNoAxesColumn, KeyRound } from "lucide-react";
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
  { href: "/settings", label: "Settings", Icon: KeyRound },
];

// Floating macOS-style dock, bottom-center on every page.
// `authEnabled` comes from the server layout: the account button only
// exists when OAuth providers are configured.
export function SiteNav({ authEnabled = false }) {
  const pathname = usePathname();

  // The sign-in screen is a clean full-page experience — no dock.
  if (pathname === "/signin") return null;

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
                    ? "border-neutral-400 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-900"
                    : "border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-900"
                }`}
              >
                <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </DockItem>
          );
        })}
        <div className="mx-1 h-8 w-px self-center bg-neutral-200 dark:bg-neutral-800" aria-hidden="true" />
        <DockItem>
          <ThemeToggle className="flex h-full w-full items-center justify-center rounded-xl border border-transparent transition hover:bg-neutral-100 dark:hover:bg-neutral-900" />
        </DockItem>
        {authEnabled && (
          <DockItem>
            <UserMenu />
          </DockItem>
        )}
      </Dock>
    </div>
  );
}
