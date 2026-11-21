/**
 * Cached person lookup for pages and the chat route.
 *
 *   - React cache(): one lookup per request, shared by generateMetadata and
 *     the page (they used to query separately).
 *   - unstable_cache: shared across requests for an hour. The build route
 *     expires the entry when a person is rebuilt.
 *
 * Misses are never cached, so a person shows up the moment their build
 * finishes.
 */

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { getPerson, type StoredPerson } from "./speeches";

class NotBuilt extends Error {}

export function personTag(slug: string): string {
  return `person:${slug}`;
}

export const getPersonCached = cache(
  async (slug: string): Promise<StoredPerson | null> => {
    try {
      return await unstable_cache(
        async () => {
          const person = await getPerson(slug);
          if (person === null) throw new NotBuilt();
          return person;
        },
        ["person", slug],
        { tags: [personTag(slug)], revalidate: 3600 },
      )();
    } catch (err) {
      if (err instanceof NotBuilt) return null;
      throw err;
    }
  },
);
