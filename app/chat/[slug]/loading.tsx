import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="mb-4 flex items-center gap-3 border-b pb-4">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-56" />
        </div>
      </header>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-4 py-2">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-3/5 max-w-[85%] rounded-2xl" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-16 w-4/5 max-w-[85%] rounded-2xl" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-1/2 max-w-[85%] rounded-2xl" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-20 w-[70%] max-w-[85%] rounded-2xl" />
        </div>
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 mt-4 flex items-center gap-2 border-t bg-background pt-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-9 w-12 rounded-lg" />
      </div>
    </div>
  );
}
