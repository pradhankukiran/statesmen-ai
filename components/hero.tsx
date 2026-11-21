import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ─── Hero ─────────────────────────────────────────────────────────────────────
//
// The canonical page-opening band: an optional eyebrow pill, a serif
// headline, supporting body copy, and a slot for trailing content (CTAs,
// status lines). Every page opens through here.
//
//   lg      ─ text-display (home)
//   default ─ text-title (everything else)

type HeroSize = "default" | "lg"

type HeroProps = {
  /** Optional eyebrow text rendered as an accent pill above the headline. */
  eyebrow?: React.ReactNode
  /** Headline content. Use Hero.Highlight inside to emphasise a word. */
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
  const headlineSize = size === "lg" ? "text-display" : "text-title"

  return (
    <header className={cn("flex w-full flex-col items-start", className)}>
      {eyebrow ? (
        <Badge variant="accent" className="mb-5">
          {eyebrow}
        </Badge>
      ) : null}

      <h1
        className={cn(
          "font-heading text-balance font-medium",
          headlineSize,
        )}
      >
        {headline}
      </h1>

      {body ? (
        <p
          className={cn(
            "mt-4 text-subheading text-muted-foreground",
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

// Emphasised word in a headline: serif italic in the accent green.
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
        "italic text-brand",
        className,
      )}
    >
      {children}
    </span>
  )
}

Hero.Highlight = HeroHighlight
