import { PersonCard, type PersonCardProps } from "@/components/person-card";

export type PersonGridItem = PersonCardProps;

export type PersonGridProps = {
  items: PersonGridItem[];
  heading?: string;
  /** Optional subtitle / metadata to display inline with heading. */
  meta?: React.ReactNode;
  /** Empty-state message when items is empty. Falsy disables the empty-state. */
  emptyMessage?: string | null;
};

export function PersonGrid({
  items,
  heading,
  meta,
  emptyMessage,
}: PersonGridProps) {
  return (
    <section className="w-full">
      {(heading || meta) && (
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          {heading && (
            <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              {heading}
            </h2>
          )}
          {meta && <div className="text-sm text-muted-foreground">{meta}</div>}
        </div>
      )}

      {items.length === 0 ? (
        emptyMessage ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : null
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.id}>
              <PersonCard {...item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
