"use client";

// Profile modal — the body of the intercepted route at
// app/@modal/(.)p/[id]/page.tsx.
//
// Soft-navigated clicks on a politician card from the landing grid land here:
// the URL becomes /p/<id> but the user stays on `/`, with a Dialog overlay
// rendering a compact profile summary on top. Closing the dialog calls
// router.back() to drop the intercepted segment and return to /.
//
// Direct loads, refresh, and share-links bypass interception and hit the
// full route at app/p/[id]/page.tsx — that page renders the long-form
// profile (AI disclaimer, bigger copy, etc.). The modal intentionally
// stays terse: portrait, name, party/term, and the Chat CTA. It's enough
// to act on without leaving the grid behind.

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";

import { ChatCta } from "@/components/chat-cta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProfileData } from "@/app/p/[id]/profile-data";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

type Props = {
  /** The raw URL segment, used as the fallback view-transition name token. */
  rawId: string;
  profile: ProfileData;
};

export function ProfileModal({ rawId, profile }: Props) {
  const router = useRouter();

  // Eyebrow assembly mirrors the full route: "PARTY · TERM" if both,
  // otherwise whichever pieces we have, with house as last-resort.
  const pillBits: string[] = [];
  if (profile.party) pillBits.push(profile.party);
  if (profile.term) pillBits.push(profile.term);
  if (pillBits.length === 0) pillBits.push(profile.house);
  const eyebrow = pillBits.join(" · ");

  // Shared-element name: matches what PersonCard and the full /p/[id] page
  // emit on the same portrait so the browser morphs the image across the
  // navigation. Numeric ids and popular-pms slugs are both safe in a CSS
  // ident behind the `portrait-` prefix.
  const transitionToken = profile.memberId ?? profile.popular?.slug ?? rawId;

  function handleOpenChange(open: boolean) {
    // The user closed via outside-click, the close button, escape, or
    // focus-out — drop the intercepted segment and restore /.
    if (!open) router.back();
  }

  return (
    <Dialog.Root defaultOpen onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            // Fade backdrop in/out; reduced-motion users get an instant cut.
            "fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm",
            "transition-opacity duration-200 ease-out",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            "motion-reduce:transition-none",
          )}
        />
        <Dialog.Popup
          className={cn(
            // Centring layer — the popup itself flexes, the inner card holds
            // the visual chrome. Animations live on this layer because
            // Dialog.Popup is what carries the start/ending data attributes.
            "fixed inset-0 z-50 grid place-items-center p-4",
            "outline-none",
            "transition-[opacity,transform] duration-200 ease-out",
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
            "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
            "motion-reduce:transition-none motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100",
          )}
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card text-card-foreground shadow-xl ring-1 ring-border">
            {/* Optional party-colour stripe — same chromatic anchor as the
                full profile, just rendered along the top edge of the card. */}
            {profile.partyColor ? (
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 block h-1"
                style={{ backgroundColor: profile.partyColor }}
              />
            ) : null}

            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:gap-6">
              {/* Portrait — fixed-width column on sm+, full-width above. */}
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border sm:w-40 sm:flex-none">
                {profile.photoUrl ? (
                  <Image
                    src={profile.photoUrl}
                    alt={`Portrait of ${profile.name}`}
                    fill
                    sizes="(min-width: 640px) 10rem, 100vw"
                    priority
                    className="object-cover"
                    style={{
                      viewTransitionName: `portrait-${transitionToken}`,
                    }}
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex h-full w-full items-center justify-center bg-brand text-4xl font-semibold tracking-tight text-brand-foreground"
                  >
                    {initials(profile.name)}
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Badge variant="brand">{eyebrow}</Badge>
                  <Dialog.Title className="font-heading text-2xl font-semibold leading-tight tracking-tight">
                    {profile.name}
                  </Dialog.Title>
                  <Dialog.Description className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {profile.house}
                  </Dialog.Description>
                </div>

                <ChatCta
                  slug={profile.slug}
                  name={profile.name}
                  memberId={profile.memberId}
                  hasAttribution={
                    profile.popular?.kind === "attribution" ? true : false
                  }
                />
              </div>
            </div>

            {/* Close button — top-right, screen-reader-friendly. We pass our
                own Button via `render` so the primitive wires up its own
                onClick to request close; the Root's onOpenChange then calls
                router.back(). */}
            <Dialog.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close profile"
                  className="absolute right-3 top-3"
                >
                  <CloseIcon />
                </Button>
              }
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Small inline X glyph — avoids dragging in another lucide-react import for
// a single icon used once.
function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}
