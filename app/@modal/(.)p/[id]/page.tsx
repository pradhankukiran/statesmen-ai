// Intercepted profile route — `(.)p/[id]` intercepts soft navigations
// originating at the same level (e.g. links rendered inside `app/page.tsx`
// pointing at `/p/<id>`). The URL still updates to /p/<id>, but the user
// stays on `/` with this slot's content rendered into the @modal slot of
// the root layout.
//
// Direct loads, refreshes, and share-links bypass interception entirely
// and hit the full route at app/p/[id]/page.tsx as before. That's the
// contract of (.) — soft same-level navs only.

import { loadProfile } from "@/app/p/[id]/profile-data";
import { ProfileModal } from "./profile-modal";

export default async function InterceptedProfileModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await loadProfile(id);

  return <ProfileModal rawId={id} profile={profile} />;
}
