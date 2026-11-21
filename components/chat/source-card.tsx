import { InsetText } from "@/components/ui/govuk";

/** A real Hansard speech a reply drew on: date, debate, excerpt. */
export function SourceCard({
  date,
  debate,
  excerpt,
  href,
  className,
}: {
  date: string;
  debate?: string | null;
  excerpt: string;
  href?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-small">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="link font-bold">
            {debate ?? "Debate"}
          </a>
        ) : (
          <span className="font-bold">{debate ?? "Debate"}</span>
        )}{" "}
        <span className="text-muted-foreground">· {date}</span>
      </p>
      <InsetText className="mt-2 line-clamp-4 text-small">{excerpt}</InsetText>
    </div>
  );
}
