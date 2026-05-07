import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-24 text-center">
      <Badge variant="secondary" className="mb-6">
        Hansard-grounded · UK politicians
      </Badge>
      <h1 className="max-w-3xl text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
        Chat with the voices of British politics.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
        Pick a Prime Minister, MP, or Lord — past or present — and have a
        conversation with an AI parody built from their real recorded
        speeches.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" disabled>
          Browse politicians
        </Button>
        <Button size="lg" variant="outline" disabled>
          Search by name
        </Button>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Coming together — search and browse land in the next phase.
      </p>
    </div>
  );
}
