import Image from "next/image"

import { cn } from "@/lib/utils"

// ─── Avatar ───────────────────────────────────────────────────────────────────
//
// A single avatar primitive used everywhere a person needs a face: the chat
// header, assistant message bubbles, and (via wrappers) profile thumbnails.
// Falls back to a brand-yellow initials tile when no photo is available.
//
// Sizes are deliberate, not arbitrary:
//   sm  ─ assistant message bubble gutter (32px)
//   md  ─ inline (40px), the default
//   lg  ─ chat header / list cards (56px)
//   xl  ─ profile hero (96px+)
//
// `loading` defaults to "lazy"; pass `loading="eager"` for above-the-fold
// avatars (chat header).

type AvatarSize = "sm" | "md" | "lg" | "xl"

type AvatarProps = {
  src?: string | null
  /** Used for both initials fallback and the alt text. */
  name: string
  size?: AvatarSize
  /** Optional override of the default initials-tile background — accepts any Tailwind bg-* token. */
  fallbackClassName?: string
  /** Pass "eager" for avatars in the initial viewport. Defaults to lazy. */
  loading?: "lazy" | "eager"
  className?: string
}

const SIZE_DIM: Record<AvatarSize, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
  xl: "size-24",
}

const SIZE_PX: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 96,
}

const SIZE_TEXT: Record<AvatarSize, string> = {
  sm: "text-[11px]",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-2xl",
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return `${first}${last}`.toUpperCase()
}

export function Avatar({
  src,
  name,
  size = "md",
  fallbackClassName,
  loading = "lazy",
  className,
}: AvatarProps) {
  const dim = SIZE_DIM[size]
  const dimPx = SIZE_PX[size]
  const textSize = SIZE_TEXT[size]
  const hasPhoto = Boolean(src)

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-full ring-1 ring-border",
        dim,
        hasPhoto ? "bg-muted" : "bg-brand text-brand-foreground",
        !hasPhoto && fallbackClassName,
        className,
      )}
      aria-hidden={hasPhoto ? undefined : true}
    >
      {hasPhoto && src ? (
        <Image
          src={src}
          alt={`Portrait of ${name}`}
          width={dimPx}
          height={dimPx}
          {...(loading === "eager" ? { priority: true } : { loading: "lazy" })}
          className="size-full object-cover"
        />
      ) : (
        <span
          className={cn(
            "flex size-full items-center justify-center font-semibold",
            textSize,
          )}
        >
          {initials(name)}
        </span>
      )}
    </div>
  )
}
