import Link from "next/link";
import { strings } from "@/lib/strings";
import { NewGroupForm } from "./new-group-form";

export default function NewGroupPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-1">
        <Link
          href="/"
          aria-label={strings.group.back}
          className="-ml-3 flex size-11 items-center justify-center text-xl"
        >
          ←
        </Link>
        <h1 className="text-2xl font-semibold">{strings.newGroup.title}</h1>
      </div>
      <NewGroupForm />
    </main>
  );
}
