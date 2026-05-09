import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary: yellow brand fill, dark text. The signature CTA. The
        // chromatic anchor of the entire app. Subtle hover (slightly
        // darker yellow), focus ring uses the brand color at low opacity
        // so it reads on white and on muted surfaces.
        primary:
          "bg-brand text-brand-foreground hover:bg-brand-hover focus-visible:ring-brand/50",
        // Default: neutral foreground fill, used for non-anchor actions
        // (e.g. error recovery alongside a primary).
        default:
          "bg-foreground text-background hover:bg-foreground/90 focus-visible:ring-foreground/30",
        outline:
          "bg-background ring-1 ring-inset ring-border hover:bg-muted hover:text-foreground focus-visible:ring-ring/40",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring/40",
        ghost:
          "hover:bg-muted hover:text-foreground focus-visible:ring-ring/40",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/15 focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/25",
        link: "text-foreground underline underline-offset-4 hover:text-foreground/80",
      },
      size: {
        sm: "h-8 px-3 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        default: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base [&_svg:not([class*='size-'])]:size-[1.125rem]",
        icon: "size-10",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
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
