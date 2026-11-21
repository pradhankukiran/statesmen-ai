import { PersonCard } from "@/components/person-card";
import { PageHeading } from "@/components/ui/govuk";
import { getPopularPMs, popularPhotoUrl } from "@/lib/popular";

export default function Home() {
  const popular = getPopularPMs();

  return (
    <>
      <PageHeading size="xl">Chat with British politicians</PageHeading>
      <p className="mt-5 max-w-[40rem] text-m">
        Ask a politician a question and get an answer drawn from their real
        speeches in Parliament.
      </p>
      <p className="mt-4 max-w-[40rem] text-body">
        Choose a Prime Minister below, or use the search at the top of the
        page to find any MP or Lord.
      </p>

      <h2 className="mt-10 mb-5 text-l font-bold">Prime Ministers</h2>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8 tablet:grid-cols-4 lg:grid-cols-7">
        {popular.map((pm) => (
          <li key={pm.slug}>
            <PersonCard
              id={pm.kind === "memberId" ? pm.id : pm.slug}
              name={pm.name}
              party={pm.party}
              partyColor={pm.partyColor}
              term={pm.term}
              photoUrl={popularPhotoUrl(pm)}
              href={`/chat/${pm.slug}`}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
