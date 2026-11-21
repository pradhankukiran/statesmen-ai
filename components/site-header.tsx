import Link from "next/link";

import { GpuStatusDot } from "@/components/gpu-status-dot";
import { HeaderSearch } from "@/components/header-search";

/**
 * GOV.UK-style header bar in brand blue, carrying our own name only (no
 * crown or GOV.UK logotype), with politician search on the right.
 */
export function SiteHeader() {
  return (
    <header className="bg-brand text-white">
      <div className="page-width flex flex-col gap-3 py-3 tablet:flex-row tablet:items-center tablet:gap-6 tablet:py-4">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-[1.5rem] leading-none font-bold tracking-tight text-white no-underline hover:underline hover:decoration-[3px] focus-visible:bg-focus focus-visible:text-foreground focus-visible:shadow-[0_-2px_var(--focus),0_4px_var(--foreground)] focus-visible:outline-none"
          >
            Statesmen AI
          </Link>
          <span className="tablet:hidden">
            <GpuStatusDot />
          </span>
        </div>
        <div className="text-foreground tablet:ml-auto tablet:w-80">
          <HeaderSearch />
        </div>
        <span className="hidden tablet:inline-flex">
          <GpuStatusDot />
        </span>
      </div>
    </header>
  );
}
