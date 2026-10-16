"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { backDelta } from "@/lib/back";
import { strings } from "@/lib/strings";

type SameOriginHistory = {
  currentEntry: { index: number } | null;
  entries(): { url: string | null }[];
};

function inAppBackDelta(): number | null {
  const navigation = (window as Window & { navigation?: SameOriginHistory }).navigation;
  if (!navigation?.currentEntry) {
    return null;
  }
  return backDelta(
    navigation.entries().map((entry) => entry.url),
    navigation.currentEntry.index,
  );
}

export function BackLink({ href }: { href: string }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const delta = inAppBackDelta();
    if (delta !== null) {
      event.preventDefault();
      window.history.go(delta);
    }
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-label={strings.group.back}
      className="-ml-3 flex size-11 shrink-0 items-center justify-center text-xl"
    >
      ←
    </Link>
  );
}
