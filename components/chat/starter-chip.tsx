import { cn } from "@/lib/utils";

/** Suggested opening question. */
export function StarterChip({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "cursor-pointer rounded-lg bg-card px-4 py-3 text-left text-small ring-1 ring-inset ring-border transition-colors hover:bg-muted hover:ring-input focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
