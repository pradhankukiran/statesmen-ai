import Link from "next/link";
import { Landmark } from "lucide-react";

// ─ Top-of-page chrome: brand mark on the left, persona tagline on the right.
//   Tagline collapses to a short pill on mobile so the header stays balanced.
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          aria-label="Statesmen AI — home"
          className="group flex items-center gap-3 rounded-sm font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <span className="flex size-10 items-center justify-center rounded-md bg-brand text-brand-foreground transition group-hover:brightness-95">
            <Landmark className="size-6" aria-hidden />
          </span>
          <span className="text-lg transition-colors group-hover:text-foreground/80">
            Statesmen AI
          </span>
        </Link>
        <nav className="text-xs uppercase tracking-widest text-muted-foreground">
          {/* ─ Long form on >=sm, short pill on mobile so the header still balances. */}
          <span className="hidden sm:block">
            Hansard-grounded · AI personas
          </span>
          <span className="sm:hidden">AI personas</span>
        </nav>
      </div>
    </header>
  );
}
