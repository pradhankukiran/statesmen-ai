import { PersonGrid, type PersonGridItem } from "@/components/person-grid";
import { Hero } from "@/components/hero";
import { getPopularPMs, popularPhotoUrl } from "@/lib/popular";

const popularItems: PersonGridItem[] = getPopularPMs().map((pm) => ({
  // memberId entries route as /p/<id>; attribution entries route as /p/<slug>.
  id: pm.kind === "memberId" ? pm.id : pm.slug,
  name: pm.name,
  party: pm.party,
  partyColor: pm.partyColor,
  house: pm.house,
  term: pm.term,
  tagline: pm.tagline,
  photoUrl: popularPhotoUrl(pm),
}));

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
      <div className="px-6 pt-10 sm:pt-14 lg:flex-shrink-0">
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
        />
      </div>

      <section className="mt-10 px-6 pb-10 sm:mt-12 sm:pb-14 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
        <PersonGrid
          heading="Popular Prime Ministers"
          meta={
            <span className="font-medium uppercase tracking-[0.16em]">
              Start here
            </span>
          }
          items={popularItems}
        />
      </section>
    </div>
  );
}
