import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
      <Card size="default" className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* Photo column. */}
          <div className="bg-muted/40">
            <Skeleton className="aspect-[3/4] w-full rounded-none" />
          </div>

          {/* Info column. */}
          <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
            <header className="flex flex-col gap-2">
              <Skeleton className="h-9 w-3/4 sm:h-10" />
              <Skeleton className="h-5 w-2/5" />
            </header>

            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-16" />
                <div className="flex items-center gap-2">
                  <Skeleton className="size-3 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>

              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </dl>

            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            <div className="mt-auto pt-2">
              <Skeleton className="h-9 w-44" />
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
