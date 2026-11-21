import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";

import { PartyLabel } from "@/components/ui/party-label";
import { getMemberPhotoUrl } from "@/lib/members";
import { cn } from "@/lib/utils";

export type PersonCardProps = {
  /**
   * Profile-route identifier: a numeric Members API id (`/p/<id>`, resolved
   * via `getMember()`) or a popular-pms slug (`/p/<slug>`).
   */
  id: number | string;
  name: string;
  party?: string | null;
  partyColor?: string | null;
  house?: string | null;
  /** Pre-formatted term e.g. "2019–2022". Wins over startedAt/endedAt. */
  term?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  tagline?: string | null;
  photoUrl?: string | null;
  /** Override the link target (defaults to the profile page). */
  href?: string;
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

/** Portrait card: photo, name, party dot and years. */
export function PersonCard({
  id,
  name,
  party,
  partyColor,
  term,
  startedAt,
  endedAt,
  photoUrl,
  href,
  className,
}: PersonCardProps) {
  const src =
    photoUrl ?? (typeof id === "number" ? getMemberPhotoUrl(id) : null);
  const years = deriveTerm(term, startedAt, endedAt);

  return (
    <Link
      href={href ?? `/p/${id}`}
      aria-label={`Open ${name}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-lg bg-card ring-1 ring-border outline-none transition-shadow hover:ring-input focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
        {src ? (
          // Shared-element morph with the profile portrait (same name).
          <ViewTransition name={`portrait-${id}`}>
            <Image
              src={src}
              alt={`Portrait of ${name}`}
              fill
              sizes="(min-width: 1024px) 14vw, (min-width: 640px) 30vw, 45vw"
              className="object-cover transition-transform duration-300 ease-standard group-hover:scale-[1.02]"
            />
          </ViewTransition>
        ) : (
          <div
            aria-hidden
            className="flex size-full items-center justify-center bg-muted text-title font-medium text-muted-foreground"
          >
            {initials(name)}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <div className="text-body font-medium leading-snug">{name}</div>
        <PartyLabel
          party={party ?? null}
          color={partyColor}
          className="text-small text-muted-foreground"
        />
        {years && <div className="text-small text-muted-foreground">{years}</div>}
      </div>
    </Link>
  );
}
