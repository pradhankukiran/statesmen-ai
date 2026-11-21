import { cn } from "@/lib/utils"

/**
 * Party name with a small colour dot. Party colours appear only here, as a
 * dot, never as fills (they clash with each other and with the accent).
 */
function PartyLabel({
  party,
  color,
  className,
}: {
  party: string | null
  /** Hex from the Members API; falls back to neutral grey. */
  color?: string | null
  className?: string
}) {
  if (!party) return null
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        className
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full ring-1 ring-black/10"
        style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
      />
      {party}
    </span>
  )
}

export { PartyLabel }
