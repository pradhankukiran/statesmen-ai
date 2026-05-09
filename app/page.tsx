import { Hero } from "@/components/hero";
import { PersonCard } from "@/components/person-card";
import { getPopularPMs, popularPhotoUrl } from "@/lib/popular";

export default function Home() {
  const popular = getPopularPMs();

  return (
    <div className="lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
      {/* Hero — aligned to the page column. */}
      <div className="mx-auto w-full max-w-6xl px-6 pt-10 sm:pt-14 lg:pt-6 lg:flex-shrink-0">
        <Hero
          size="lg"
          eyebrow="Hansard-grounded · UK politicians"
          headline={
            <>
              Chat with the{" "}
              <Hero.Highlight>voices</Hero.Highlight>{" "}
              of British politics.
            </>
          }
          body="Pick a Prime Minister, MP, or Lord — past or present — and have a conversation with an AI persona built from their real recorded speeches. Search any politician from the bar in the header."
          bodyMaxWidth="max-w-none"
        />
      </div>

      {/* Popular row — wrapped in max-w-6xl + px-6 so the entire section
          (heading + scrolling cards) sits inside the page column and is
          centered horizontally. The row scrolls within the column when
          cards overflow; the column's own gutters provide the breathing
          room from the viewport edges. */}
      <section className="mt-10 sm:mt-12 lg:mt-6 lg:flex-1 lg:min-h-0 lg:overflow-y-hidden">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
              Popular Prime Ministers
            </h2>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-[0.16em]">
                Start here · Scroll for more →
              </span>
            </div>
          </div>

          <ul className="flex gap-4 overflow-x-auto pb-10 sm:pb-14 lg:pb-6 [scrollbar-width:thin]">
            {popular.map((pm) => (
              <li
                key={pm.slug}
                className="w-44 shrink-0 sm:w-48 md:w-52 lg:w-56"
              >
                <PersonCard
                  id={pm.kind === "memberId" ? pm.id : pm.slug}
                  name={pm.name}
                  party={pm.party}
                  partyColor={pm.partyColor}
                  house={pm.house}
                  term={pm.term}
                  tagline={pm.tagline}
                  photoUrl={popularPhotoUrl(pm)}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
