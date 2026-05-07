import popularPMs from "@/data/popular-pms.json";
import { PersonGrid, type PersonGridItem } from "@/components/person-grid";
import { SearchBar } from "@/components/search-bar";

const popularItems: PersonGridItem[] = popularPMs.map((pm) => ({
  id: pm.id,
  name: pm.name,
  party: pm.party,
  partyColor: pm.partyColor,
  house: pm.house,
  term: pm.term,
  tagline: pm.tagline,
  photoUrl: pm.photoUrl,
}));

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24">
      {/* Hero */}
      <section className="flex flex-col items-start">
        <span className="mb-8 inline-block bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
          Hansard-grounded · UK politicians
        </span>

        <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          Chat with the{" "}
          <span className="bg-brand box-decoration-clone px-3 text-brand-foreground">
            voices
          </span>{" "}
          of British politics.
        </h1>

        <p className="mt-8 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Pick a Prime Minister, MP, or Lord — past or present — and have a
          conversation with an AI persona built from their real recorded
          speeches.
        </p>
      </section>

      {/* Search + popular grid */}
      <section className="mt-14 sm:mt-20">
        <SearchBar>
          <PersonGrid
            heading="Popular Prime Ministers"
            meta={
              <span className="uppercase tracking-widest text-xs">
                Start here
              </span>
            }
            items={popularItems}
          />
        </SearchBar>
      </section>
    </div>
  );
}
