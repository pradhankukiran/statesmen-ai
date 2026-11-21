import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/** GOV.UK field: 2px black border, square, yellow focus outline. */
export const fieldClassName =
  "focus-field w-full min-w-0 border-2 border-input bg-background p-[5px] text-body text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(fieldClassName, "h-10", className)}
      {...props}
    />
  )
}

export { Input }
