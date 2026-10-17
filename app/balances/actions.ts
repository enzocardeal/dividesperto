"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import type { ActionState } from "@/app/groups/actions";
import { BALANCE_VIEW_COOKIE, parseBalanceView } from "@/lib/settlement/view";

const VIEW_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export async function setBalanceView(_state: ActionState, formData: FormData): Promise<ActionState> {
  (await cookies()).set(BALANCE_VIEW_COOKIE, parseBalanceView(formData.get("view")), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: VIEW_COOKIE_MAX_AGE_SECONDS,
  });
  refresh();
  return { error: null };
}
