/**
 * Slugify a person's display name into a stable cache key.
 *
 * Used as the persona artefact key (e.g. `margaret-thatcher.md`) and as the
 * URL segment for `/chat/{slug}` and `/build/{slug}`. Members API ids drive
 * `/p/{id}`, so this function is invoked at the moment of "Chat with X"
 * to bridge id-keyed pages into slug-keyed persona artefacts.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
