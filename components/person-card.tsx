import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getMemberPhotoUrl } from "@/lib/members";

export type PersonCardProps = {
  id: number;
  name: string;
  party?: string | null;
  partyColor?: string | null;
  house?: string | null;
  /** Pre-formatted term/era string e.g. "2019–2022". Wins over startedAt/endedAt. */
  term?: string | null;
  /** Optional ISO date for fallback term derivation. */
  startedAt?: string | null;
  endedAt?: string | null;
  tagline?: string | null;
  photoUrl?: string | null;
  className?: string;
};

function yearOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})/.exec(iso);
  return m ? m[1] : null;
}

function deriveTerm(
  term?: string | null,
  startedAt?: string | null,
  endedAt?: string | null,
): string | null {
  if (term) return term;
  const start = yearOf(startedAt);
  if (!start) return null;
  const end = yearOf(endedAt);
  return end ? `${start}–${end}` : `${start}–`;
}

export function PersonCard({
  id,
  name,
  party,
  partyColor,
  house,
  term,
  startedAt,
  endedAt,
  tagline,
  photoUrl,
  className,
}: PersonCardProps) {
  const src = photoUrl ?? getMemberPhotoUrl(id);
  const derivedTerm = deriveTerm(term, startedAt, endedAt);
  const subtitleParts: string[] = [];
  if (house) subtitleParts.push(house);
  if (derivedTerm) subtitleParts.push(derivedTerm);
  const subtitle = subtitleParts.join(" · ");

  return (
    <Link
      href={`/p/${id}`}
      aria-label={`Open profile for ${name}`}
      className={cn(
        "group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <Card
        size="sm"
        className="h-full transition-colors group-hover:bg-muted/50 group-focus-visible:bg-muted/50"
      >
        <div className="aspect-[3/4] w-full overflow-hidden bg-muted">
          {/* Plain <img> intentional: next/image needs remotePatterns config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Portrait of ${name}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
        <CardContent className="flex flex-col gap-1.5">
          <div className="font-heading text-base leading-snug font-medium">
            {name}
          </div>
          {(party || subtitle) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {party && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block size-2 rounded-full ring-1 ring-foreground/15"
                    style={{
                      backgroundColor: partyColor ?? "var(--muted-foreground)",
                    }}
                  />
                  <span className="text-foreground/80">{party}</span>
                </span>
              )}
              {party && subtitle && (
                <span aria-hidden className="text-muted-foreground/60">·</span>
              )}
              {subtitle && <span>{subtitle}</span>}
            </div>
          )}
          {tagline && (
            <div className="text-xs text-muted-foreground/80">{tagline}</div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
