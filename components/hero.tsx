import * as React from "react"

import { PageHeading } from "@/components/ui/govuk"
import { cn } from "@/lib/utils"

/**
 * Page intro: heading (with optional caption), a lead paragraph, and a slot
 * for actions. GOV.UK pattern: heading-l + body-l lead.
 */
export function Hero({
  caption,
  headline,
  body,
  children,
  className,
}: {
  caption?: React.ReactNode
  headline: React.ReactNode
  body?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("w-full", className)}>
      <PageHeading caption={caption}>{headline}</PageHeading>
      {body ? <p className="mt-5 max-w-[40rem] text-m font-normal">{body}</p> : null}
      {children ? <div className="mt-6 w-full">{children}</div> : null}
    </header>
  )
}
