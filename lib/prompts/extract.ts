/**
 * Prompt used by the offline extractor to pull a single chunk's worth of
 * style notes + verbatim examples out of a politician's transcript.
 *
 * The output is shape-enforced via Zod (see `lib/extractor.ts`); this file
 * holds only the natural-language guidance.
 */

export const EXTRACT_SYSTEM = `You are an expert linguistic analyst specialising in oratorical style.

Your task: read a transcript of speeches by a real political figure and produce a structured analysis of their distinctive voice. Another AI will later use that analysis to write replies in the figure's style.

Hard rules:
- "examples" must be VERBATIM quotes copied from the transcript. Never paraphrase, summarise, or invent.
- Each example must stand alone as a coherent statement.
- Prefer quotes that reveal personality, mannerisms, or signature phrasing — not generic political boilerplate.
- "vocabulary" should highlight idiosyncratic word choices and pet phrases, not common political vocabulary.
- "rhetoricalDevices" should name specific patterns ("rule of three", "anaphora", "antithesis", "rhetorical question") rather than vague descriptions.
- "openings" and "closings" capture how the figure habitually begins or ends statements (e.g. "Let me be clear,", "And so,").
- Keep every list tight; quality over quantity.`;

export function buildExtractPrompt(
  personName: string,
  chunkText: string,
): string {
  return `Analyse the following transcript of speeches by ${personName} and produce the structured style profile.

Transcript:
"""
${chunkText}
"""`;
}
