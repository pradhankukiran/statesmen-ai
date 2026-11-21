/**
 * Everyday display name from a Members API name: drops leading honorifics
 * ("Mr Gordon Brown" → "Gordon Brown", "Sir Keir Starmer" → "Keir Starmer").
 * Peerage titles ("Baroness May of Maidenhead") are how peers are known, so
 * they stay. Safe on the client.
 */
const HONORIFICS = /^(?:(?:The\s+)?(?:Rt\.?\s+Hon\.?|Mr|Mrs|Ms|Miss|Mx|Dr|Sir|Dame)\.?\s+)+/i;

export function displayName(raw: string): string {
  const cleaned = raw.replace(HONORIFICS, "").trim();
  return cleaned.length > 0 ? cleaned : raw.trim();
}
