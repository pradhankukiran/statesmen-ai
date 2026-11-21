import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PhaseBanner } from "@/components/ui/govuk";

/** Browsing layout: header, phase banner, page content, footer. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <PhaseBanner tag="Beta">
        This is not a government service. Replies are AI-generated from real
        speeches in Parliament.
      </PhaseBanner>
      {/* page-width uses auto margins, which would shrink a flex item to
          its content; the plain block wrapper keeps it full width. */}
      <main className="flex-1">
        <div className="page-width pt-6 pb-10 tablet:pt-10 tablet:pb-16">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
