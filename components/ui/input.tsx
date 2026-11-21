import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/** Shared field styling for Input and Textarea. */
export const fieldClassName =
  "w-full min-w-0 rounded-sm bg-card px-3 text-body text-foreground outline-none ring-1 ring-inset ring-input transition-shadow placeholder:text-muted-foreground focus-visible:ring-foreground/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:ring-destructive"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(fieldClassName, "h-10 py-1 text-small", className)}
      {...props}
    />
  )
}

export { Input }
