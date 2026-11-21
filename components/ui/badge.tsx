import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// GOV.UK tag: short status label on a tinted background.
const badgeVariants = cva(
  "inline-block max-w-40 px-2 pt-0.5 pb-[3px] text-small font-normal break-words",
  {
    variants: {
      variant: {
        blue: "bg-[#d2e2f1] text-[#0f385c]",
        grey: "bg-[#cecece] text-foreground",
        green: "bg-[#cfe4dc] text-[#083d29]",
        red: "bg-[#f4d7d7] text-[#651b1b]",
        yellow: "bg-[#fff8cc] text-[#806f00]",
      },
    },
    defaultVariants: { variant: "blue" },
  }
)

function Badge({
  className,
  variant = "blue",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { className: cn(badgeVariants({ variant }), className) },
      props
    ),
    render,
    state: { slot: "badge", variant },
  })
}

export { Badge, badgeVariants }
