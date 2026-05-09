import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 sm:px-6 lg:h-full lg:min-h-0 lg:overflow-hidden">
      {/* Header — mirrors the lg avatar + 2xl name in the live chat. */}
      <div className="flex items-center gap-4 border-b border-border py-6 sm:py-8 lg:flex-shrink-0">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-56 rounded-md" />
          <Skeleton className="h-3 w-44 rounded-md" />
        </div>
      </div>

      {/* Empty-state skeleton — matches the conversation-not-yet-started look. */}
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <div className="flex flex-col gap-12 py-16 sm:py-24">
          <div className="flex flex-col items-start gap-5">
            <span
              aria-hidden
              className="inline-block h-6 w-44 rounded-md bg-brand"
            />
            <Skeleton className="h-9 w-3/4 max-w-md rounded-md" />
            <Skeleton className="h-9 w-1/2 max-w-sm rounded-md" />
            <Skeleton className="mt-1 h-5 w-full max-w-xl rounded-md" />
            <Skeleton className="h-5 w-3/5 max-w-md rounded-md" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-64 rounded-full" />
            <Skeleton className="h-10 w-72 rounded-full" />
            <Skeleton className="h-10 w-56 rounded-full" />
          </div>
        </div>
      </div>

      {/* Composer placeholder — soft Card-style textarea. */}
      <div className="sticky bottom-0 -mx-4 mt-auto bg-background pb-4 pt-3 sm:-mx-6 sm:pb-6 lg:mt-0 lg:flex-shrink-0">
        <div className="mx-auto flex w-full max-w-3xl px-4 sm:px-6">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <Skeleton className="mx-auto mt-3 h-3 w-72 rounded-md" />
      </div>
    </div>
  );
}
