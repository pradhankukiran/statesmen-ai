import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 sm:px-6">
      {/* Header — mirrors the lg avatar + 3xl name in the live chat. */}
      <div className="flex items-center gap-4 border-b-2 border-border py-6 sm:py-8">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>

      {/* Empty-state skeleton — matches the conversation-not-yet-started look. */}
      <div className="flex flex-col gap-12 py-16 sm:py-24">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-7 w-44 rounded-none" />
          <Skeleton className="h-10 w-3/4 max-w-md" />
          <Skeleton className="h-10 w-1/2 max-w-sm" />
          <Skeleton className="mt-1 h-5 w-full max-w-xl" />
          <Skeleton className="h-5 w-3/5 max-w-md" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-12 w-64 rounded-md" />
          <Skeleton className="h-12 w-72 rounded-md" />
          <Skeleton className="h-12 w-56 rounded-md" />
        </div>
      </div>

      {/* Composer — mirrors the textarea + flat brand-yellow send block. */}
      <div className="sticky bottom-0 -mx-4 mt-auto bg-background pb-4 pt-3 sm:-mx-6 sm:pb-6">
        <div className="mx-auto flex w-full max-w-3xl items-stretch gap-2 px-4 sm:px-6">
          <Skeleton className="h-[3.25rem] flex-1 rounded-md" />
          <Skeleton className="h-[3.25rem] w-[3.25rem] rounded-md" />
        </div>
        <Skeleton className="mx-auto mt-3 h-3 w-72" />
      </div>
    </div>
  );
}
