"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { strings } from "@/lib/strings";

export function GroupTabs({ groupId }: { groupId: string }) {
  const pathname = usePathname();
  const base = `/groups/${groupId}`;
  const tabs = [
    { href: base, label: strings.group.expenses, children: `${base}/expenses` },
    { href: `${base}/balances`, label: strings.group.balances, children: `${base}/payments` },
    { href: `${base}/activity`, label: strings.group.activity, children: null },
  ];

  return (
    <nav className="-mb-px flex">
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.children !== null && pathname.startsWith(tab.children));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center border-b-2 text-sm font-medium ${
              active ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
