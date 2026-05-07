/**
 * Smoke test: pull a real corpus via the Members + Hansard clients and print
 * stats. Run with `npm run script:fetch`.
 *
 * Verifies:
 *   1. Members API search returns valid members.
 *   2. Hansard search by date range + AttributedTo filter (historical PMs).
 *   3. Hansard search by memberId (modern PMs).
 *   4. Pagination iterator walks pages correctly.
 */

import { searchMembers } from "../lib/members";
import { iterateContributions, searchContributions } from "../lib/hansard";

const div = (label: string) =>
  console.log(`\n── ${label} ${"─".repeat(Math.max(0, 70 - label.length))}`);

const sample = (s: string, n = 160) =>
  s.length > n ? `${s.slice(0, n).trim()}…` : s;

async function main() {
  console.log("Statesmen AI · data-layer smoke test");

  div("1. Members API search: 'Thatcher' (former)");
  {
    const { total, members } = await searchMembers({
      name: "Thatcher",
      includeFormer: true,
    });
    console.log(`Total: ${total}`);
    for (const m of members.slice(0, 5)) {
      console.log(
        `  · id=${m.id.toString().padStart(4)}  ${m.name.padEnd(30)} ${m.house.padEnd(7)}  ${m.party ?? "–"}`,
      );
    }
  }

  div("2. Hansard: Thatcher PM-era speeches (Falklands, 1982)");
  {
    const { total, contributions } = await searchContributions({
      searchTerm: "falklands",
      startDate: "1982-04-01",
      endDate: "1982-06-30",
      attributedTo: "The Prime Minister",
      take: 50,
    });
    console.log(
      `Search hits: ${total}  ·  Filtered to PM: ${contributions.length}`,
    );
    for (const c of contributions.slice(0, 3)) {
      console.log(
        `  · ${c.date.slice(0, 10)}  [${c.attributedTo}] ${c.house}`,
      );
      console.log(`    "${sample(c.text)}"`);
    }
  }

  div("3. Hansard by memberId: a modern PM");
  {
    const { members } = await searchMembers({
      name: "Boris Johnson",
      includeFormer: true,
      take: 5,
    });
    const boris = members.find((m) => /Boris Johnson/i.test(m.name));
    if (!boris) {
      console.log("  Boris Johnson not found in Members API.");
    } else {
      console.log(`  Member id=${boris.id}  ${boris.name}  ${boris.party}`);
      const { total, contributions } = await searchContributions({
        memberId: boris.id,
        take: 5,
        orderBy: "SittingDateDesc",
      });
      console.log(`  Total contributions indexed: ${total}`);
      for (const c of contributions.slice(0, 3)) {
        console.log(
          `    · ${c.date.slice(0, 10)}  ${c.debateSection ?? "(no section)"}`,
        );
        console.log(`      "${sample(c.text)}"`);
      }
    }
  }

  div("4. Pagination: walk Thatcher PM-era topics, capped");
  {
    let count = 0;
    let pmCount = 0;
    let lastDate = "";
    for await (const c of iterateContributions({
      searchTerm: "Falklands",
      startDate: "1982-04-01",
      endDate: "1982-07-31",
      pageSize: 50,
      maxPages: 2,
      pageDelayMs: 500,
    })) {
      count++;
      lastDate = c.date.slice(0, 10);
      if (c.attributedTo === "The Prime Minister") pmCount++;
    }
    console.log(
      `  Iterated ${count} contributions across ≤2 pages (${pmCount} PM); last date: ${lastDate}`,
    );
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nFAILED:", err);
  process.exit(1);
});
