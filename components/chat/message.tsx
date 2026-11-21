import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** The visitor's question: grey panel, like GOV.UK's question boxes. */
export function UserMessage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-[#f3f3f3] p-[15px]", className)}>
      <p className="mb-1 text-small font-bold">You asked</p>
      <div className="whitespace-pre-wrap text-body">{children}</div>
    </div>
  );
}

/**
 * The persona's reply: portrait and name, then the answer. `pending` shows a
 * plain status line until the first words arrive.
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
    <div className={className} aria-busy={pending || undefined}>
      <div className="mb-2 flex items-center gap-2">
        <Avatar name={name} src={photoUrl} size="sm" />
        <p className="text-small font-bold">{name}</p>
      </div>
      {pending ? (
        <p className="text-body text-muted-foreground">Searching their speeches…</p>
      ) : (
        children
      )}
    </div>
  );
}
