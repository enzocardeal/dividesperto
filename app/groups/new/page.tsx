import { BackLink } from "@/components/back-link";
import { strings } from "@/lib/strings";
import { NewGroupForm } from "./new-group-form";

export default function NewGroupPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-1">
        <BackLink href="/" />
        <h1 className="text-2xl font-semibold">{strings.newGroup.title}</h1>
      </div>
      <NewGroupForm />
    </main>
  );
}
