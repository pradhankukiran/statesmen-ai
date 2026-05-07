import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function BuildLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
      <Card>
        <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
          <header className="flex flex-col gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-3/5 sm:h-9" />
            <div className="flex flex-col gap-1.5 pt-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </header>

          <div className="flex flex-col gap-3 border-l border-border pl-5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
