"use client";

import {
  Bell,
  Bookmark,
  Compass,
  Home,
  LogOut,
  type LucideIcon,
  Mail,
  Menu,
  Search,
  Settings,
  User as UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BrandMark } from "@/components/site/brand-mark";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { signOutAction } from "@/lib/auth/sign-out-action";

/**
 * Mobile-only navigation chrome. Below the `md:` breakpoint the desktop
 * sidebar is hidden, so we render a thin sticky top header with the
 * brand + a hamburger that opens a drawer of the same nav items
 * (DEFECTS.md → D-12). Closes itself on route changes so navigating
 * doesn't leave the overlay open.
 */

type Viewer = {
  handle: string;
  name: string | null;
  image: string | null;
} | null;

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  requiresAuth?: boolean;
};

const PRIMARY_ITEMS: NavItem[] = [
  { href: "/feed", label: "Home", icon: Home, requiresAuth: true },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "#", label: "Notifications", icon: Bell, disabled: true, requiresAuth: true },
  { href: "#", label: "Messages", icon: Mail, disabled: true, requiresAuth: true },
  { href: "#", label: "Bookmarks", icon: Bookmark, disabled: true, requiresAuth: true },
];

const SECONDARY_ITEMS: NavItem[] = [
  { href: "/me", label: "Profile", icon: UserIcon, requiresAuth: true },
  { href: "/me/settings", label: "Settings", icon: Settings, requiresAuth: true },
];

export function MobileTopBar({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const signedIn = viewer !== null;

  // Each NavLink calls this on click so the drawer dismisses as the
  // route changes. Avoids a useEffect/setState-in-effect dance.
  const close = () => setOpen(false);

  const items = (list: NavItem[]) =>
    list.filter((i) => signedIn || !i.requiresAuth);

  return (
    <header className="border-border bg-background sticky top-0 z-30 flex h-12 items-center justify-between border-b px-3 md:hidden">
      <Link href="/" aria-label="DevNest home">
        <BrandMark size="sm" />
      </Link>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
        </DialogTrigger>
        <DialogContent
          showCloseButton={false}
          className="flex h-screen max-h-screen w-full max-w-[320px] translate-x-[-50%] translate-y-[-50%] flex-col gap-0 rounded-none p-0 sm:max-w-[320px]"
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Primary site navigation
          </DialogDescription>

          <div className="border-border flex items-center justify-between border-b px-3 py-3">
            {signedIn ? (
              <Link
                href={`/u/${viewer.handle}`}
                className="flex items-center gap-2"
              >
                <Avatar className="size-8">
                  {viewer.image ? (
                    <AvatarImage src={viewer.image} alt="Your avatar" />
                  ) : null}
                  <AvatarFallback>
                    {(viewer.name ?? viewer.handle).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium leading-tight">
                    {viewer.name ?? viewer.handle}
                  </div>
                  <div className="text-[var(--color-ink-faint)] truncate font-mono text-[11px] leading-tight">
                    @{viewer.handle}
                  </div>
                </div>
              </Link>
            ) : (
              <BrandMark size="sm" />
            )}
            <ThemeToggle />
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-2">
            <ul className="space-y-0.5">
              {items(PRIMARY_ITEMS).map((item) => (
                <li key={item.label}>
                  <NavLink item={item} pathname={pathname} onNavigate={close} />
                </li>
              ))}
            </ul>

            {signedIn ? null : (
              <Button asChild className="mt-3 w-full" size="sm">
                <Link href="/signin" onClick={close}>
                  Sign in
                </Link>
              </Button>
            )}

            <ul className="mt-4 space-y-0.5">
              {items(SECONDARY_ITEMS).map((item) => (
                <li key={item.label}>
                  <NavLink item={item} pathname={pathname} onNavigate={close} />
                </li>
              ))}
            </ul>
          </nav>

          {signedIn ? (
            <form
              action={signOutAction}
              className="border-border border-t px-3 py-3"
            >
              <button
                type="submit"
                className="text-destructive hover:bg-[var(--color-hover)] flex w-full items-center gap-2 rounded px-2 py-2 text-[14px] transition-colors"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </header>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = pathname === item.href;
  const Icon = item.icon;

  const className = [
    "flex h-10 items-center gap-2.5 rounded px-2 text-[14px] transition-colors",
    active
      ? "bg-[var(--color-accent-bg)] text-[var(--color-accent-ink)] font-medium"
      : "text-foreground hover:bg-[var(--color-hover)]",
    item.disabled ? "cursor-not-allowed opacity-50 hover:bg-transparent" : "",
  ].join(" ");

  if (item.disabled) {
    return (
      <span className={className} aria-disabled="true" title="Coming in v0.2">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span>{item.label}</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      className={className}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}
