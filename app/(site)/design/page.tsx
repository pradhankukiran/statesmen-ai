import type { Metadata } from "next";

import { ComposerDemo } from "./composer-demo";
import { PersonaMessage, UserMessage } from "@/components/chat/message";
import { SourceCard } from "@/components/chat/source-card";
import { StarterChip } from "@/components/chat/starter-chip";
import { Hero } from "@/components/hero";
import { PersonCard } from "@/components/person-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartyLabel } from "@/components/ui/party-label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

// Living style guide. Not linked from the app; visit /design directly.
export const metadata: Metadata = {
  title: "Design system — Statesmen AI",
  robots: { index: false, follow: false },
};

const COLOURS = [
  { name: "Background", token: "background", hex: "#ffffff", className: "bg-background" },
  { name: "Text", token: "foreground", hex: "#18181b", className: "bg-foreground" },
  { name: "Muted", token: "muted", hex: "#f4f4f5", className: "bg-muted" },
  { name: "Muted text", token: "muted-foreground", hex: "#63636b", className: "bg-muted-foreground" },
  { name: "Border", token: "border", hex: "#e4e4e7", className: "bg-border" },
  { name: "Input", token: "input", hex: "#d4d4d8", className: "bg-input" },
  { name: "Primary", token: "brand", hex: "#18181b", className: "bg-brand" },
  { name: "Error", token: "destructive", hex: "#b42318", className: "bg-destructive" },
];

const TYPE = [
  { name: "title", className: "text-title font-semibold tracking-tight", sample: "Chat with British politicians" },
  { name: "heading", className: "text-heading font-semibold", sample: "Prime Ministers" },
  { name: "body", className: "text-body", sample: "We faced a global banking crisis, and we had to deal with it decisively." },
  { name: "small", className: "text-small text-muted-foreground", sample: "Labour · 2007–2010" },
  { name: "label", className: "text-label text-muted-foreground", sample: "17 November 2008 · G20 Summit" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-border pt-8">
      <h2 className="text-heading font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-12 lg:h-full lg:overflow-y-auto">
      <Hero
        headline="Design system"
        body="Plain and functional: white, near-black, neutral greys, one sans font. Every screen is built from the pieces on this page."
      />

      <Section title="Colour">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {COLOURS.map((c) => (
            <li key={c.token} className="overflow-hidden rounded-lg bg-card ring-1 ring-border">
              <div className={`h-12 ${c.className} border-b border-border`} />
              <div className="p-3">
                <div className="text-small font-medium">{c.name}</div>
                <div className="font-mono text-label text-muted-foreground">
                  {c.token} · {c.hex}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <ul className="flex flex-col gap-6">
          {TYPE.map((t) => (
            <li key={t.name} className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-baseline">
              <code className="font-mono text-label text-muted-foreground">{t.name}</code>
              <span className={t.className}>{t.sample}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="md">Medium</Button>
          <Button variant="primary" size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Badges and labels">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="neutral">500 speeches</Badge>
          <Badge variant="outline">Commons</Badge>
          <Badge variant="destructive">Failed</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-small text-muted-foreground">
          <PartyLabel party="Labour" color="#d50000" />
          <PartyLabel party="Conservative" color="#0063ba" />
          <PartyLabel party="Liberal Democrat" color="#faa61a" />
          <PartyLabel party="Crossbench" color={null} />
        </div>
      </Section>

      <Section title="Fields">
        <div className="grid max-w-xl gap-3">
          <Input placeholder="Search politicians…" />
          <Textarea placeholder="Multi-line text…" rows={2} />
        </div>
      </Section>

      <Section title="Avatars and loading">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name="Boris Johnson" src="https://members-api.parliament.uk/api/Members/1423/Thumbnail" size="xl" />
          <Avatar name="Boris Johnson" src="https://members-api.parliament.uk/api/Members/1423/Thumbnail" size="lg" />
          <Avatar name="Gordon Brown" size="lg" />
          <Avatar name="Gordon Brown" size="md" />
          <Avatar name="Gordon Brown" size="sm" />
          <Skeleton className="h-10 w-40" />
        </div>
      </Section>

      <Section title="Person card">
        <div className="grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
          <PersonCard
            id={1423}
            name="Boris Johnson"
            party="Conservative"
            partyColor="#0063ba"
            term="2019–2022"
            href="/design"
          />
          <PersonCard
            id="example"
            name="Gordon Brown"
            party="Labour"
            partyColor="#d50000"
            term="2007–2010"
            photoUrl={null}
            href="/design"
          />
        </div>
      </Section>

      <Section title="Chat">
        <div className="flex max-w-2xl flex-col gap-6 rounded-lg bg-background p-4 ring-1 ring-border">
          <div className="flex flex-col gap-1.5">
            <StarterChip>How did you handle the 2008 banking crisis?</StarterChip>
            <StarterChip>What did you make of the G20 summit?</StarterChip>
          </div>
          <UserMessage>How did you handle the 2008 banking crisis?</UserMessage>
          <PersonaMessage name="Gordon Brown">
            <p>
              We faced a global banking crisis, and we had to deal with it
              decisively. The first thing to do was to provide liquidity to the
              banking system.
            </p>
          </PersonaMessage>
          <PersonaMessage name="Gordon Brown" pending />
          <div className="grid gap-3 sm:grid-cols-2">
            <SourceCard
              date="17 November 2008"
              debate="G20 Summit"
              excerpt="When the right hon. and learned Gentleman was Chancellor, debt was 44 per cent. of GDP."
              href="https://hansard.parliament.uk"
            />
            <SourceCard
              date="29 March 2010"
              debate="European Council"
              excerpt="We had a global banking crisis, and we had to recapitalise the banks."
            />
          </div>
          <ComposerDemo />
        </div>
      </Section>
    </div>
  );
}
