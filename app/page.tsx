import { strings } from "@/lib/strings";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-4">
      <h1 className="text-3xl font-semibold">{strings.app.name}</h1>
      <p className="text-neutral-600">{strings.app.description}</p>
      <p className="text-sm text-neutral-500">{strings.home.soon}</p>
    </main>
  );
}
