export function SiteFooter() {
  return (
    <footer className="border-t-4 border-brand">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Statesmen AI</span>{" "}
          builds conversational AI personas from real public speeches recorded
          in{" "}
          <a
            href="https://hansard.parliament.uk"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Hansard
          </a>
          . Responses are AI-generated and do not represent actual statements
          by the people depicted.
        </p>
      </div>
    </footer>
  );
}
