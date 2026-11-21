import { cn } from "@/lib/utils";

/** Suggested question, styled as a GOV.UK link. */
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
      className={cn("link cursor-pointer text-left text-body disabled:cursor-not-allowed disabled:opacity-50", className)}
    >
      {children}
    </button>
  );
}
