import Link from "next/link";
import { strings } from "@/lib/strings";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">{strings.notFound.title}</h1>
      <Link href="/" className="font-medium underline">
        {strings.notFound.home}
      </Link>
    </main>
  );
}
