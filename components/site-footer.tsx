// Bottom-of-page chrome: a single disclaimer paragraph under a hairline
// border. Minimal by design — the design system reserves the brand color
// for fills and accents, not chrome dividers.
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 text-sm text-muted-foreground">
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
      </div>
    </footer>
  );
}
