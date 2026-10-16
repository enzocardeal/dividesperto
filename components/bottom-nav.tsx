"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { strings } from "@/lib/strings";

const HIDDEN_ON = ["/login", "/invite"];

type Section = "groups" | "balances";

type NavItem = { href: string; label: string; icon: ReactNode; active: boolean };

export function BottomNav() {
  const pathname = usePathname();
  return HIDDEN_ON.includes(pathname) ? null : <BottomNavBar current={sectionOf(pathname)} />;
}

function sectionOf(pathname: string): Section | null {
  if (pathname === "/" || pathname.startsWith("/groups/")) {
    return "groups";
  }
  return pathname === "/balances" ? "balances" : null;
}

export function BottomNavBar({ current }: { current: Section | null }) {
  const items: NavItem[] = [
    { href: "/", label: strings.nav.groups, icon: <GroupsIcon />, active: current === "groups" },
    { href: "/balances", label: strings.overall.title, icon: <BalancesIcon />, active: current === "balances" },
  ];

  return (
    <nav
      aria-label={strings.nav.label}
      className="sticky bottom-0 z-40 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex h-(--bottom-nav-height) max-w-md">
        {items.map((item) => (
          <li key={item.href} className="flex flex-1">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                item.active ? "text-neutral-900" : "text-neutral-500"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-6"
    >
      {children}
    </svg>
  );
}

function GroupsIcon() {
  return (
    <Icon>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </Icon>
  );
}

function BalancesIcon() {
  return (
    <Icon>
      <path d="M4 8h15l-4-4" />
      <path d="M20 16H5l4 4" />
    </Icon>
  );
}
