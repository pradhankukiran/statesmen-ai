import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// GOV.UK Design System patterns, rebuilt in Tailwind. Names follow the
// GOV.UK component names so the source of each pattern is easy to find.

/** Back link: small underlined link with a left chevron. */
export function BackLink({
  href,
  children = "Back",
  className,
}: {
  href: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("link inline-flex items-center gap-1 text-small !text-foreground", className)}
    >
      <ChevronLeft className="size-3.5" aria-hidden />
      {children}
    </Link>
  );
}

/** Caption + heading. Caption is the grey line above a page title. */
export function PageHeading({
  caption,
  children,
  size = "l",
  className,
}: {
  caption?: React.ReactNode;
  children: React.ReactNode;
  size?: "xl" | "l" | "m";
  className?: string;
}) {
  const heading = { xl: "text-xl", l: "text-l", m: "text-m" }[size];
  const cap = { xl: "text-m", l: "text-m", m: "text-body" }[size];
  return (
    <div className={className}>
      {caption && (
        <span className={cn("mb-1 block text-muted-foreground", cap)}>{caption}</span>
      )}
      <h1 className={cn("font-bold text-balance", heading)}>{children}</h1>
    </div>
  );
}

/** Inset text: quoted or supporting content behind a thick grey rule. */
export function InsetText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-l-[10px] border-border p-[15px]", className)}>
      {children}
    </div>
  );
}

/** Details: "Show more" disclosure with GOV.UK's triangle summary. */
export function Details({
  summary,
  children,
  className,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details className={cn("group text-body", className)}>
      <summary className="link inline-flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="inline-block size-0 border-y-[7px] border-l-[12px] border-y-transparent border-l-current transition-none group-open:rotate-90"
        />
        {summary}
      </summary>
      <div className="mt-3 border-l-[5px] border-border pl-[15px]">{children}</div>
    </details>
  );
}

/** Notification banner: blue (important) or green (success). */
export function NotificationBanner({
  title,
  children,
  tone = "info",
  className,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "info" | "success";
  className?: string;
}) {
  const colour = tone === "success" ? "border-action bg-action" : "border-brand bg-brand";
  return (
    <div
      role={tone === "success" ? "alert" : "region"}
      aria-label={title}
      className={cn("border-[5px]", colour, className)}
    >
      <p className="px-[10px] pt-0.5 pb-[5px] text-body font-bold text-white">{title}</p>
      <div className="bg-background p-[15px] text-body">{children}</div>
    </div>
  );
}

/** Phase banner: tag plus a line of text, under the header. */
export function PhaseBanner({
  tag,
  children,
}: {
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border py-[10px]">
      <p className="page-width flex items-baseline gap-[10px] text-small">
        <Badge variant="blue" className="shrink-0">
          {tag}
        </Badge>
        <span>{children}</span>
      </p>
    </div>
  );
}

/** Summary list: key / value rows with a rule under each. */
export function SummaryList({
  rows,
  className,
}: {
  rows: { key: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("text-body", className)}>
      {rows.map((r) => (
        <div
          key={r.key}
          className="flex flex-col border-b border-border py-[10px] tablet:flex-row tablet:gap-5"
        >
          <dt className="mb-1 font-bold tablet:mb-0 tablet:w-[30%]">{r.key}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Error summary: red-bordered box listing what went wrong. */
export function ErrorSummary({
  title = "There is a problem",
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("border-[5px] border-destructive p-[15px] tablet:p-5", className)}
    >
      <h2 className="mb-3 text-m font-bold">{title}</h2>
      <div className="text-body">{children}</div>
    </div>
  );
}
