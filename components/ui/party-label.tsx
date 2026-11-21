import { cn } from "@/lib/utils"

/** Party name with a small square of the party colour. */
function PartyLabel({
  party,
  color,
  className,
}: {
  party: string | null
  /** Hex from the Members API; falls back to grey. */
  color?: string | null
  className?: string
}) {
  if (!party) return null
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        aria-hidden
        className="size-2.5 shrink-0"
        style={{ backgroundColor: color ?? "#858686" }}
      />
      {party}
    </span>
  )
}

export { PartyLabel }
