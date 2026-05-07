import Link from "next/link";
import { Landmark } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <Landmark className="size-5" aria-hidden />
          <span>Statesmen AI</span>
        </Link>
        <nav className="text-sm text-muted-foreground">
          <span aria-hidden>Hansard-grounded · AI parody</span>
        </nav>
      </div>
    </header>
  );
}
