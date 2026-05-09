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

      {/* Popular row — heading sits in the page column; on lg+ the card
          row uses grid-cols-7 across the full viewport (with px-6 gutters)
          so all 7 PMs are visible without scrolling. Cards auto-size to
          fit. Below lg, fall back to a horizontal scroller with fixed-
          width cards. */}
      <section className="mt-10 sm:mt-12 lg:mt-6 lg:flex-1 lg:min-h-0 lg:overflow-y-hidden">
        <div className="mx-auto mb-5 flex w-full max-w-6xl flex-wrap items-baseline justify-between gap-3 px-6">
          <h2 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
            Popular Prime Ministers
          </h2>
          <div className="hidden text-xs text-muted-foreground lg:block">
            <span className="font-medium uppercase tracking-[0.16em]">
              Start here
            </span>
          </div>
        </div>

        <ul className="flex gap-4 overflow-x-auto px-6 pb-10 sm:pb-14 lg:pb-6 [scrollbar-width:thin] lg:grid lg:grid-cols-7 lg:overflow-x-visible">
          {popular.map((pm) => (
            <li
              key={pm.slug}
              className="w-44 shrink-0 sm:w-48 md:w-52 lg:w-auto lg:shrink"
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
      </section>
    </div>
  );
}
