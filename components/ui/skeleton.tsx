import { cn } from "@/lib/utils"

/** Loading placeholder. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
