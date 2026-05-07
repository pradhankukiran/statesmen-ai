/**
 * Prompt used by the merger to consolidate N independent chunk extractions
 * into ONE coherent persona profile.
 *
 * Each chunk extraction was produced independently from a different slice of
 * the speaker's transcript, so there is heavy overlap and noise across them.
 * The merger's job is to deduplicate, synthesise, and curate.
 */

import type { Extraction } from "../extractor";

export const MERGE_SYSTEM = `You are an expert linguistic synthesist. You will be given several independent style analyses of the same speaker — each produced from a different chunk of their transcripts — and you must produce ONE consolidated persona profile.

Hard rules:
- Deduplicate items that appear across chunks. Treat near-duplicates (capitalisation, slight wording) as one entry.
- Pick the strongest, most distinctive items — quality over quantity.
- For "examples": choose 20–30 of the BEST verbatim quotes from across all chunks. Prefer those that are short, self-contained, and reveal personality, idiosyncrasy, or signature phrasing.
- All examples must be VERBATIM — copy them exactly as they appear in the chunk extractions. Never paraphrase, summarise, or invent.
- For "tone" and "sentencePatterns": synthesise ONE coherent multi-sentence description that captures the through-line across chunks, not a list.
- Preserve the speaker's actual voice and traits. Do not editorialise or moralise.
- Lists should be tight — favour fewer strong items over many weak ones.`;

export function buildMergePrompt(
  name: string,
  extractions: Extraction[],
): string {
  const chunks = extractions
    .map(
      (e, i) =>
        `=== Chunk ${i + 1} extraction ===\n${JSON.stringify(e, null, 2)}`,
    )
    .join("\n\n");

  return `Speaker: ${name}

Below are ${extractions.length} independent chunk extractions from this speaker's transcripts. Consolidate them into ONE persona.

${chunks}

Produce the consolidated persona now.`;
}
