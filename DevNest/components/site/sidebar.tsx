"use client";

import {
  Bell,
  Bookmark,
  ChevronDown,
  Compass,
  Home,
  type LucideIcon,
  LogOut,
  Mail,
  Settings,
  User as UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { BrandMark } from "@/components/site/brand-mark";
import { signOutAction } from "@/lib/auth/sign-out-action";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Visual-only kbd hint (binding lands in a future change). */
  kbd?: string;
  /** Disable links to features that aren't built yet. */
  disabled?: boolean;
  /** Numeric badge (notifications / messages); 0 hides. */
  badge?: number;
  /** When true, the item is only relevant to authenticated viewers. */
  requiresAuth?: boolean;
};

const PRIMARY_ITEMS: NavItem[] = [
  { href: "/feed", label: "Home", icon: Home, kbd: "g h", requiresAuth: true },
  { href: "/explore", label: "Explore", icon: Compass, kbd: "g e" },
  // Notifications + messages: visible-but-disabled placeholders. The
  // backing features aren't built (item 9 of the original product
  // vision); the nav slots ship now so the visual rhythm of the
  // sidebar is correct.
  { href: "#", label: "Notifications", icon: Bell, kbd: "g n", disabled: true, requiresAuth: true },
  { href: "#", label: "Messages", icon: Mail, kbd: "g m", disabled: true, requiresAuth: true },
  { href: "#", label: "Bookmarks", icon: Bookmark, kbd: "g b", disabled: true, requiresAuth: true },
];

const SECONDARY_ITEMS: NavItem[] = [
  { href: "/me", label: "Profile", icon: UserIcon, kbd: "g p", requiresAuth: true },
  { href: "/me/settings", label: "Settings", icon: Settings, kbd: "g ,", requiresAuth: true },
];

type Viewer = {
  handle: string;
  name: string | null;
  image: string | null;
} | null;

export function Sidebar({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const signedIn = viewer !== null;

  return (
    <aside
      className="border-border bg-card sticky top-0 hidden h-screen flex-col border-r [--sidebar-pad:14px] md:flex"
      style={{ width: "var(--col-nav)" }}
      aria-label="Primary"
    >
      <div className="px-[var(--sidebar-pad)] pt-5 pb-3">
        <Link href="/" aria-label="DevNest home">
          <BrandMark size="md" />
        </Link>
      </div>

      <nav className="flex-1 px-2 py-2">
        <ul className="space-y-0.5">
          {PRIMARY_ITEMS.filter((i) => signedIn || !i.requiresAuth).map((item) => (
            <li key={item.label}>
              <NavLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>

        {signedIn ? (
          <Button asChild className="mt-3 w-full" size="sm">
            <Link href="/feed">New post</Link>
          </Button>
        ) : (
          <Button asChild className="mt-3 w-full" size="sm">
            <Link href="/signin">Sign in</Link>
          </Button>
        )}

        <ul className="mt-4 space-y-0.5">
          {SECONDARY_ITEMS.filter((i) => signedIn || !i.requiresAuth).map((item) => (
            <li key={item.label}>
              <NavLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>

      <ProfileMenu viewer={viewer} />
    </aside>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href;
  const Icon = item.icon;

  const className = [
    "group flex h-8 items-center gap-2.5 rounded px-2 text-[14px] transition-colors",
    active
      ? "bg-[var(--color-accent-bg)] text-[var(--color-accent-ink)] font-medium"
      : "text-foreground hover:bg-[var(--color-hover)]",
    item.disabled
      ? "cursor-not-allowed opacity-50 hover:bg-transparent"
      : "",
  ].join(" ");

  const inner = (
    <>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <span className="bg-[var(--color-accent)] text-white inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px]">
          {item.badge}
        </span>
      ) : null}
      {item.kbd ? (
        <kbd className="text-[var(--color-ink-faint)] font-mono text-[11px]">
          {item.kbd}
        </kbd>
      ) : null}
    </>
  );

  if (item.disabled) {
    return (
      <span
        className={className}
        title="Coming in v0.2"
        aria-disabled="true"
      >
        {inner}
      </span>
    );
  }
  return (
    <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
      {inner}
    </Link>
  );
}

function ProfileMenu({ viewer }: { viewer: Viewer }) {
  if (!viewer) {
    return (
      <div className="border-border flex items-center justify-between gap-2 border-t px-[var(--sidebar-pad)] py-3">
        <span className="text-[var(--color-ink-faint)] min-w-0 truncate font-mono text-[11px]">
          not signed in
        </span>
        <ThemeToggle />
      </div>
    );
  }
  const initials = (viewer.name ?? viewer.handle).slice(0, 2).toUpperCase();
  return (
    <div className="border-border border-t px-2 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Profile menu"
            className="hover:bg-[var(--color-hover)] flex w-full items-center gap-2.5 rounded p-1.5 text-left transition-colors"
          >
            <Avatar className="size-7">
              {viewer.image ? (
                <AvatarImage src={viewer.image} alt="Your avatar" />
              ) : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium leading-tight">
                {viewer.name ?? viewer.handle}
              </div>
              <div className="text-[var(--color-ink-faint)] truncate font-mono text-[11px] leading-tight">
                @{viewer.handle}
              </div>
            </div>
            <ChevronDown className="text-[var(--color-ink-faint)] size-4 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/u/${viewer.handle}`}>View profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/me/settings">Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <div className="flex w-full items-center justify-between">
              <span>Theme</span>
              <ThemeToggle />
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              // Radix closes the menu by default; preventDefault stops it
              // from swallowing the event before our action fires (the
              // server-side redirect inside signOutAction handles the
              // route change). DEFECTS.md → D-11.
              event.preventDefault();
              void signOutAction();
            }}
            className="text-destructive cursor-pointer"
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
