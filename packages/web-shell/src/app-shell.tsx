"use client";

import { LogOut, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@repo/ui";
import { useSession } from "@repo/web-shared";

import { ZONE_BASE } from "./zone-bases";

const NAV = [
  { href: `${ZONE_BASE.dashboard}/dashboard`, label: "Dashboard" },
  { href: `${ZONE_BASE.customers}/customers`, label: "Customers" },
  { href: `${ZONE_BASE.invoices}/invoices`, label: "Invoices" },
  { href: `${ZONE_BASE.dashboard}/users`, label: "Users", adminOnly: true },
];

const initials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const AppShell = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) {
      menuButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileOpen) {
      drawerRef.current?.focus();
    }
  }, [mobileOpen]);

  const nav = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Main navigation">
      {NAV.filter((item) => !item.adminOnly || user?.role === "ADMIN").map((item) => {
        // Cross-zone links point at real URLS (other zones); active state only
        // meaningfully matches the current zone's link, so compare the pathname
        // portion — no window access at render (this page also prerenders).
        const path = item.href.replace(/^https?:\/\/[^/]+/, "");
        const active = pathname.startsWith(path);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              FOCUS_RING,
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r bg-card md:block">
        <div className="flex h-14 items-center border-b px-4">
          <Link href={ZONE_BASE.dashboard} className={`text-sm font-semibold tracking-tight rounded-sm ${FOCUS_RING}`}>
            SLM <span className="text-primary">ERP</span>
          </Link>
        </div>
        {nav}
      </aside>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMobileOpen(false);
            }
          }}
        >
          <button
            className="absolute inset-0 h-full w-full cursor-default bg-black/85 animate-fade-in"
            onClick={() => setMobileOpen(false)}
            tabIndex={-1}
            aria-label="Close menu"
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            className="absolute left-0 top-0 flex h-full w-56 flex-col border-r bg-card outline-none animate-slide-in-left"
          >
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="text-sm font-semibold tracking-tight">
                SLM <span className="text-primary">ERP</span>
              </span>
              <button
                className={`flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent ${FOCUS_RING}`}
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6">
          <button
            ref={menuButtonRef}
            className={`rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden ${FOCUS_RING}`}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <div className="hidden text-sm text-muted-foreground md:block">Mini ERP Invoicing System</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-2 rounded-full p-1 hover:bg-accent ${FOCUS_RING}`}
                  aria-label="User menu"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{user ? initials(user.name) : "?"}</AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left sm:block">
                    <p className="text-xs font-medium leading-tight">{user?.name}</p>
                    <Badge variant={user?.role === "ADMIN" ? "default" : "secondary"} className="mt-0.5 h-5 px-2 text-[11px]">
                      {user?.role}
                    </Badge>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-sm">
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void logout()}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
};
