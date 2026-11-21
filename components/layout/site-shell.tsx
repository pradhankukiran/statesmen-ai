import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * Browsing layout: header with search, page content, footer. On large
 * screens the page fits the viewport and inner regions scroll.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <SiteHeader />
      <main className="flex-1 lg:min-h-0 lg:overflow-hidden">{children}</main>
      <SiteFooter />
    </div>
  );
}
