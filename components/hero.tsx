import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ─── Hero ─────────────────────────────────────────────────────────────────────
//
// The canonical page-opening band: an optional brand-yellow eyebrow pill, a
// confident headline, supporting body copy, and slot for trailing content
// (CTAs, status accents, etc.). One component — every page that used to
// hand-roll this rhythm now goes through here.
//
// Sizes cap deliberately: lg = text-4xl/5xl, default = text-3xl/4xl. No
// text-7xl. Restraint is the point.

type HeroSize = "default" | "lg"

type HeroProps = {
  /** Optional eyebrow text rendered as a brand-yellow pill above the headline. */
  eyebrow?: React.ReactNode
  /** Headline content. Use Hero.Highlight inside to apply the brand-yellow word marker. */
  headline: React.ReactNode
  /** Optional supporting paragraph below the headline. */
  body?: React.ReactNode
  /** Trailing slot — typically CTAs or a status accent line. */
  children?: React.ReactNode
  size?: HeroSize
  /** Override the inner max-width. Defaults to a sensible measure for body copy. */
  bodyMaxWidth?: string
  className?: string
}

export function Hero({
  eyebrow,
  headline,
  body,
  children,
  size = "default",
  bodyMaxWidth,
  className,
}: HeroProps) {
  const headlineSize =
    size === "lg"
      ? "text-4xl sm:text-5xl"
      : "text-3xl sm:text-4xl"

  return (
    <header className={cn("flex w-full flex-col items-start", className)}>
      {eyebrow ? (
        <Badge variant="brand" className="mb-6">
          {eyebrow}
        </Badge>
      ) : null}

      <h1
        className={cn(
          "text-balance font-semibold leading-[1.1] tracking-tight",
          headlineSize,
        )}
      >
        {headline}
      </h1>

      {body ? (
        <p
          className={cn(
            "mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg",
            bodyMaxWidth ?? "max-w-2xl",
          )}
        >
          {body}
        </p>
      ) : null}

      {children ? <div className="mt-8 w-full">{children}</div> : null}
    </header>
  )
}

// Inline span that paints a brand-yellow background behind a single emphasized
// word in the headline. `box-decoration-clone` makes the highlight wrap
// gracefully across line breaks.
function HeroHighlight({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "box-decoration-clone bg-brand px-2 text-brand-foreground",
        className,
      )}
    >
      {children}
    </span>
  )
}

Hero.Highlight = HeroHighlight
