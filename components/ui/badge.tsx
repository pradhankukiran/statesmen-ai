import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Badge: small uppercase label pill.
//   accent      ─ Green tint. Section eyebrows ("Begin conversation").
//   neutral     ─ Warm grey. Counts and metadata.
//   outline     ─ Border only. Inline tags.
//   lords       ─ Lords red tint. Marks House of Lords members.
//   destructive ─ Red tint. Inline errors.
const badgeVariants = cva(
  "eyebrow inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-sm px-2 whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        accent: "bg-brand-subtle text-brand",
        neutral: "bg-muted text-muted-foreground",
        outline: "text-muted-foreground ring-1 ring-inset ring-border",
        lords: "bg-lords-subtle text-lords",
        destructive: "bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant = "neutral",
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
