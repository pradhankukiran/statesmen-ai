import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// GOV.UK button: square, sits on a 2px shadow, presses down 2px when
// clicked, turns yellow with black text on keyboard focus.
//   primary   ─ green. The main action on a page.
//   secondary ─ light grey. Other actions.
//   warning   ─ red. Destructive actions.
//   ghost     ─ no chrome. Icon actions in toolbars.
//   link      ─ looks like a link.
const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 border-2 border-transparent text-center whitespace-nowrap select-none active:top-[2px] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:top-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.1em]",
  {
    variants: {
      variant: {
        primary:
          "bg-action text-white shadow-[0_2px_0_var(--action-shadow)] hover:bg-action-hover active:shadow-none disabled:hover:bg-action",
        secondary:
          "bg-[#f3f3f3] text-foreground shadow-[0_2px_0_#858686] hover:bg-[#cecece] active:shadow-none disabled:hover:bg-[#f3f3f3]",
        warning:
          "bg-destructive text-white shadow-[0_2px_0_#651b1b] hover:bg-[#982828] active:shadow-none",
        ghost: "text-foreground hover:bg-muted active:top-0",
        link: "text-link underline underline-offset-[0.1578em] hover:text-link-hover active:top-0",
      },
      size: {
        sm: "px-2 pt-1 pb-[3px] text-small",
        md: "px-2.5 pt-2 pb-[7px] text-body leading-none",
        lg: "px-4 pt-2.5 pb-2 text-m font-bold leading-none",
        icon: "size-10 p-0",
        "icon-sm": "size-8 p-0",
      },
    },
    compoundVariants: [
      // Keyboard focus: GOV.UK yellow with black text and shadow.
      {
        variant: ["primary", "secondary", "warning"],
        className:
          "focus-visible:border-focus focus-visible:bg-focus focus-visible:text-foreground focus-visible:shadow-[0_2px_0_var(--foreground)] focus-visible:outline-none",
      },
      {
        variant: ["ghost", "link"],
        className:
          "focus-visible:bg-focus focus-visible:text-foreground focus-visible:shadow-[0_-2px_var(--focus),0_4px_var(--foreground)] focus-visible:outline-none focus-visible:no-underline",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
