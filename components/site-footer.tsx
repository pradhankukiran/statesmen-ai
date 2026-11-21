import { photoCredits } from "@/lib/popular";

/** GOV.UK-style footer: light blue surface under a 10px brand-blue rule. */
export function SiteFooter() {
  const credits = photoCredits();
  return (
    <footer className="border-t-[10px] border-brand bg-surface pt-6 pb-4 tablet:pt-10 tablet:pb-6">
      <div className="page-width flex flex-col gap-3 text-small">
        <p>
          Statesmen AI is an independent project. It is not affiliated with UK
          Parliament or the UK government. Replies are AI-generated from{" "}
          <a href="https://hansard.parliament.uk" target="_blank" rel="noreferrer" className="link">
            Hansard
          </a>{" "}
          speeches and are not real statements by the people shown.
        </p>
        <p className="text-muted-foreground">
          Contains Parliamentary information licensed under the{" "}
          <a
            href="https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/"
            target="_blank"
            rel="noreferrer"
            className="link"
          >
            Open Parliament Licence v3.0
          </a>
          . Official portraits © UK Parliament, licensed under{" "}
          <a
            href="https://creativecommons.org/licenses/by/3.0/"
            target="_blank"
            rel="noreferrer"
            className="link"
          >
            CC BY 3.0
          </a>
          .{credits.length > 0 && <> Other photos: {credits.join(" · ")}.</>}
        </p>
      </div>
    </footer>
  );
}
