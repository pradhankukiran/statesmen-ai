import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldClassName } from "@/components/ui/input"

/** GOV.UK textarea. Grows with its content up to `max-h`. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldClassName,
        "field-sizing-content block min-h-10 resize-none leading-[1.25]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
