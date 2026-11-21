import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Page heading: a plain title, an optional line of supporting text, and a
 * slot for actions. No eyebrows, no decorative emphasis.
 */
export function Hero({
  headline,
  body,
  children,
  className,
}: {
  headline: React.ReactNode
  body?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex w-full flex-col items-start", className)}>
      <h1 className="text-title font-semibold tracking-tight text-balance">
        {headline}
      </h1>
      {body ? (
        <p className="mt-2 max-w-2xl text-body text-muted-foreground">{body}</p>
      ) : null}
      {children ? <div className="mt-6 w-full">{children}</div> : null}
    </header>
  )
}
