import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getMemberPhotoUrl } from "@/lib/members";

export type PersonCardProps = {
  /**
   * Profile-route identifier. Either:
   *   - a numeric Members API id (modern PMs / search results), routed as
   *     `/p/<id>` and resolved via `getMember()`; or
   *   - a string slug (historical / popular-pms entries), routed as
   *     `/p/<slug>` and resolved via the popular-pms registry.
   */
  id: number | string;
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
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
  const src =
    photoUrl ?? (typeof id === "number" ? getMemberPhotoUrl(id) : null);
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
        "group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <Card
        size="sm"
        className="h-full transition-colors group-hover:bg-muted/50"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          {src ? (
            // Shared-element morph: the profile page (and its loading skeleton)
            // wrap their portrait in <ViewTransition name="portrait-<id>">
            // with the same id, so React coordinates a morph across the
            // navigation. `id` is either a numeric Members API id or a
            // popular-pms slug — both safe in a CSS ident.
            <ViewTransition name={`portrait-${id}`}>
              <Image
                src={src}
                alt={`Portrait of ${name}`}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </ViewTransition>
          ) : (
            <div
              aria-hidden
              className="flex h-full w-full items-center justify-center bg-brand text-3xl font-semibold tracking-tight text-brand-foreground sm:text-4xl"
            >
              {initials(name)}
            </div>
          )}
        </div>
        <CardContent className="flex flex-col gap-1.5">
          <div className="font-heading text-[0.9375rem] leading-snug font-medium">
            {name}
          </div>
          {(party || subtitle) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {party && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block size-2 rounded-full ring-1 ring-inset ring-foreground/15"
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
