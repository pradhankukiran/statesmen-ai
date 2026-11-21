import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

/** A real Hansard speech a reply drew on: date, debate, quoted excerpt. */
export function SourceCard({
  date,
  debate,
  excerpt,
  href,
  className,
}: {
  /** Display date, e.g. "17 November 2008". */
  date: string;
  debate?: string | null;
  excerpt: string;
  href?: string | null;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-label text-muted-foreground">
        <span>{date}</span>
        {debate && (
          <>
            <span aria-hidden>·</span>
            <span className="truncate">{debate}</span>
          </>
        )}
        {href && <ExternalLink className="ml-auto size-3 shrink-0" aria-hidden />}
      </div>
      <blockquote className="mt-1.5 line-clamp-4 text-small">
        {excerpt}
      </blockquote>
    </>
  );

  const shell = cn(
    "block rounded-lg bg-card p-3 ring-1 ring-inset ring-border",
    href && "transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    className,
  );

  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={shell}>
      {body}
    </a>
  ) : (
    <div className={shell}>{body}</div>
  );
}
