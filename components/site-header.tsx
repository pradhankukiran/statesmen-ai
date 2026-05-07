import Link from "next/link";
import { Landmark } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-3 font-semibold tracking-tight"
        >
          <span className="flex size-10 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <Landmark className="size-6" aria-hidden />
          </span>
          <span className="text-lg">Statesmen AI</span>
        </Link>
        <nav className="hidden text-xs uppercase tracking-widest text-muted-foreground sm:block">
          Hansard-grounded · AI personas
        </nav>
      </div>
    </header>
  );
}
