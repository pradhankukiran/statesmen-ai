/**
 * Speeches a chat reply drew on, sent from the chat route to the browser as
 * message metadata. Client-safe: no server imports.
 */

export type ReplySource = {
  /** Hansard ContributionExtId. */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  house: string;
  debate: string | null;
  /** Hansard debate page, when the debate ID is known. */
  url: string | null;
  excerpt: string;
};

export type ChatMetadata = { sources?: ReplySource[] };

/** "2008-11-17" → "17 November 2008". */
export function formatSourceDate(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? isoDate
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
}

/** First ~`max` characters, cut at a word boundary. */
export function excerptOf(text: string, max = 280): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}
