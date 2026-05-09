import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Badge: small status/eyebrow chip. Six variants:
//   - brand     ─ the signature yellow eyebrow pill, used at the top of every
//                 hero. Uppercase tracking-widest, dense type.
//   - default   ─ neutral foreground fill (rare).
//   - secondary ─ muted fill, for "X results" counters etc.
//   - outline   ─ ring-only, for inline tags.
//   - destructive ─ inline error tag.
//   - link      ─ underlined inline link disguised as a badge.
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        brand:
          "h-6 bg-brand px-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-brand-foreground",
        default:
          "h-5 bg-foreground px-2 py-0.5 text-background [a]:hover:bg-foreground/85",
        secondary:
          "h-5 bg-secondary px-2 py-0.5 text-secondary-foreground [a]:hover:bg-secondary/80",
        outline:
          "h-5 px-2 py-0.5 text-foreground ring-1 ring-inset ring-border [a]:hover:bg-muted",
        destructive:
          "h-5 bg-destructive/10 px-2 py-0.5 text-destructive ring-1 ring-inset ring-destructive/20 [a]:hover:bg-destructive/15",
        link: "h-5 px-1 py-0.5 text-foreground underline underline-offset-4 hover:text-foreground/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
