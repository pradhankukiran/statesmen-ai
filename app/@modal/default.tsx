// Default fallback for the @modal parallel slot.
//
// When the active route doesn't match any of the slot's segments (e.g. on the
// landing page itself, where no profile is open), Next.js renders this file.
// Returning null keeps the slot empty so the page underneath shows through
// untouched.
//
// Without this default, navigating to a route that the slot can't match would
// trigger a 404 — parallel slots require an explicit "render nothing" branch.
export default function Default() {
  return null;
}
