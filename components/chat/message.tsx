import { Loader2 } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** The visitor's message: right-aligned, warm grey bubble. */
export function UserMessage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-end", className)}>
      <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted px-4 py-2.5 text-body sm:max-w-[75%]">
        {children}
      </div>
    </div>
  );
}

/**
 * The persona's reply: avatar in the gutter, no bubble, full reading width.
 * `pending` shows a quiet "thinking" line until the first token arrives.
 */
export function PersonaMessage({
  name,
  photoUrl,
  pending = false,
  children,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  pending?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 sm:gap-4", className)}>
      <Avatar name={name} src={photoUrl} size="sm" />
      <div className="min-w-0 flex-1 pt-1 text-body" aria-busy={pending || undefined}>
        {pending ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Reading the record…
          </span>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
