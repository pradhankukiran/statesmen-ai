import { photoCredits } from "@/lib/popular";

/** Disclaimer and image credits under a hairline. */
export function SiteFooter() {
  const credits = photoCredits();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-small text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Statesmen AI</span>{" "}
          builds AI personas from real{" "}
          <a
            href="https://hansard.parliament.uk"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Hansard
          </a>{" "}
          speeches. Responses are AI-generated, not actual statements by those
          depicted.
        </p>
        {credits.length > 0 && (
          <p className="text-label">Photos: {credits.join(" · ")}.</p>
        )}
      </div>
    </footer>
  );
}
