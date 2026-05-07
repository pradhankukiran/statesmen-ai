import { ExternalLink } from "lucide-react";

// ─ Bottom-of-page chrome: disclaimer paragraph + a thin divider row of meta links.
//   Stacks on mobile, sits side-by-side on >=sm.
export function SiteFooter() {
  return (
    <footer className="border-t-4 border-brand">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Statesmen AI</span>{" "}
          builds conversational AI personas from real public speeches recorded
          in{" "}
          <a
            href="https://hansard.parliament.uk"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Hansard
          </a>
          . Responses are AI-generated and do not represent actual statements
          by the people depicted.
        </p>

        {/* ─ Secondary meta row: stacks under the disclaimer on mobile,
            right-aligned on >=sm. Very muted; underline-on-hover only. */}
        <div className="mt-3 flex items-center justify-between gap-4 border-t border-border/40 pt-3 text-xs">
          <span className="hidden sm:inline" aria-hidden />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:justify-end">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
            >
              Source on GitHub
              <ExternalLink className="size-3" aria-hidden />
            </a>
            <a
              href="https://hansard.parliament.uk"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Built with Hansard
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
