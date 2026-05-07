export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        <p>
          Statesmen AI is a parody. Personas are AI generations grounded in real
          public speeches from{" "}
          <a
            href="https://hansard.parliament.uk"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Hansard
          </a>{" "}
          — but the responses are not actual statements by the people depicted.
        </p>
      </div>
    </footer>
  );
}
