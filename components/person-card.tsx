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

/** GOV.UK people-grid style: portrait, name as a link, party and years. */
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
      className={cn("group block focus-box outline-none", className)}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
        {src ? (
          // Shared-element morph with the profile portrait (same name).
          <ViewTransition name={`portrait-${id}`}>
            <Image
              src={src}
              alt=""
              fill
              sizes="(min-width: 1024px) 140px, (min-width: 640px) 30vw, 45vw"
              className="object-cover"
            />
          </ViewTransition>
        ) : (
          <div
            aria-hidden
            className="flex size-full items-center justify-center text-l font-bold text-muted-foreground"
          >
            {initials(name)}
          </div>
        )}
      </div>
      <p className="mt-2 text-body font-bold text-link underline decoration-1 underline-offset-[0.1578em] group-hover:text-link-hover group-hover:decoration-[3px] group-focus-visible:bg-focus group-focus-visible:text-foreground group-focus-visible:no-underline">
        {name}
      </p>
      <PartyLabel
        party={party ?? null}
        color={partyColor}
        className="mt-1 text-small"
      />
      {years && <p className="text-small text-muted-foreground">{years}</p>}
    </Link>
  );
}
