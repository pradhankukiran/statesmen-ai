import Link from "next/link";
import { Landmark } from "lucide-react";

import { GpuStatusDot } from "@/components/gpu-status-dot";
import { HeaderSearch } from "@/components/header-search";

// Top-of-page chrome: brand mark on the left, search in the middle, persona
// tagline on the right (tagline collapses on narrow screens to keep search
// from getting squeezed).
export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-6 sm:gap-6">
        <Link
          href="/"
          aria-label="Statesmen AI — home"
          className="group flex shrink-0 items-center gap-2.5 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="flex size-8 items-center justify-center rounded-md bg-brand text-brand-foreground transition-colors group-hover:bg-brand-hover">
            <Landmark className="size-[1.125rem]" aria-hidden />
          </span>
          <span className="hidden text-base transition-colors group-hover:text-foreground/80 sm:inline">
            Statesmen AI
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-md">
            <HeaderSearch />
          </div>
        </div>
        <nav className="hidden text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground lg:block">
          Hansard-grounded · AI personas
        </nav>
        <div className="ml-1 flex shrink-0 items-center">
          <GpuStatusDot />
        </div>
      </div>
    </header>
  );
}
