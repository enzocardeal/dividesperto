import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { strings } from "@/lib/strings";
import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-4">
      <h1 className="text-3xl font-semibold">{strings.app.name}</h1>
      <p className="text-neutral-600">{strings.app.description}</p>
      <p className="text-sm text-neutral-500">{strings.home.soon}</p>
      <Suspense>
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) {
    return null;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  return (
    <form action={signOut} className="mt-6 flex items-center justify-between gap-4">
      <p className="text-neutral-700">
        {strings.home.greeting} {profile?.display_name ?? data?.claims.email}
      </p>
      <button
        type="submit"
        className="min-h-11 rounded-lg border border-neutral-300 px-4 font-medium"
      >
        {strings.home.logout}
      </button>
    </form>
  );
}
