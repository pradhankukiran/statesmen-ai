import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldClassName } from "@/components/ui/input"

/** Multi-line text field. Grows with its content up to `max-h`. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldClassName,
        "field-sizing-content min-h-10 resize-none py-2.5 [scrollbar-width:thin]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
