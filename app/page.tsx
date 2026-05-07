import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-start px-6 py-24 sm:py-32">
      <span className="mb-8 inline-block bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
        Hansard-grounded · UK politicians
      </span>

      <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
        Chat with the{" "}
        <span className="bg-brand box-decoration-clone px-3 text-brand-foreground">
          voices
        </span>{" "}
        of British politics.
      </h1>

      <p className="mt-8 max-w-2xl text-lg text-muted-foreground sm:text-xl">
        Pick a Prime Minister, MP, or Lord — past or present — and have a
        conversation with an AI parody built from their real recorded
        speeches.
      </p>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" disabled>
          Browse politicians
        </Button>
        <Button size="lg" variant="outline" disabled>
          Search by name
        </Button>
      </div>

      <p className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Search and browse arrive in the next phase.
      </p>
    </div>
  );
}
