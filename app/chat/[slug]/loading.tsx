import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 py-5 sm:py-6">
        <Skeleton className="size-11 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>

      {/* Empty-state skeleton — matches the conversation-not-yet-started look. */}
      <div className="flex flex-col gap-8 py-16 sm:py-24">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-3/4 max-w-md" />
          <Skeleton className="h-9 w-1/2 max-w-sm" />
          <Skeleton className="mt-1 h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-3/5 max-w-md" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-56 rounded-full" />
          <Skeleton className="h-9 w-64 rounded-full" />
          <Skeleton className="h-9 w-48 rounded-full" />
        </div>
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 mt-auto -mx-4 bg-background pb-3 pt-2 sm:-mx-6 sm:pb-4">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 sm:px-6">
          <Skeleton className="h-12 flex-1 rounded-2xl" />
        </div>
        <Skeleton className="mx-auto mt-2 h-3 w-64" />
      </div>
    </div>
  );
}
