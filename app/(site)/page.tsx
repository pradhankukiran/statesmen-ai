import { PersonCard } from "@/components/person-card";
import { getPopularPMs, popularPhotoUrl } from "@/lib/popular";

export default function Home() {
  const popular = getPopularPMs();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:h-full lg:overflow-y-auto">
      <h1 className="text-title font-semibold tracking-tight">
        Chat with British politicians
      </h1>
      <p className="mt-1 max-w-2xl text-body text-muted-foreground">
        Each one answers from their real speeches in Parliament. Pick a Prime
        Minister below, or search for any MP or Lord.
      </p>

      <h2 className="mt-8 mb-3 text-heading font-semibold">Prime Ministers</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
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
    </div>
  );
}
