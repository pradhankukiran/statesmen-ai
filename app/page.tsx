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

      {/* Popular row — heading aligns to the page column, but the card
          scroller bleeds past max-w-6xl so the row visibly overflows the
          gutter on wide screens (intentional "there's more here" cue). */}
      <section className="mt-10 sm:mt-12 lg:mt-6 lg:flex-1 lg:min-h-0 lg:overflow-y-hidden">
        <div className="mx-auto mb-5 flex w-full max-w-6xl flex-wrap items-baseline justify-between gap-3 px-6">
          <h2 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
            Popular Prime Ministers
          </h2>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-[0.16em]">
              Start here · Scroll for more →
            </span>
          </div>
        </div>

        {/*
          Plain horizontal scroller — no snap. Real DOM spacer <li>
          elements at both ends guarantee the 16px gutters (browser
          counts them in scrollWidth regardless of flex+overflow-x-auto
          quirks). Inter-card spacing comes from `mr-4` on every card
          except the last.
        */}
        <ul className="flex overflow-x-auto pb-10 sm:pb-14 lg:pb-6 [scrollbar-width:thin]">
          <li role="presentation" aria-hidden="true" className="w-4 shrink-0" />
          {popular.map((pm, i) => (
            <li
              key={pm.slug}
              className={`w-40 shrink-0 sm:w-44 md:w-48 lg:w-52${
                i < popular.length - 1 ? " mr-4" : ""
              }`}
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
          <li role="presentation" aria-hidden="true" className="w-4 shrink-0" />
        </ul>
      </section>
    </div>
  );
}
