import Link from "next/link";
import { Landmark } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="group flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="flex size-7 items-center justify-center rounded-sm bg-brand text-brand-foreground">
            <Landmark className="size-4" aria-hidden />
          </span>
          <span>Statesmen AI</span>
        </Link>
        <nav className="hidden text-xs uppercase tracking-widest text-muted-foreground sm:block">
          Hansard-grounded · AI parody
        </nav>
      </div>
    </header>
  );
}
