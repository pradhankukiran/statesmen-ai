import type { Metadata } from "next";

import { ComposerDemo } from "./composer-demo";
import { PersonaMessage, UserMessage } from "@/components/chat/message";
import { SourceCard } from "@/components/chat/source-card";
import { StarterChip } from "@/components/chat/starter-chip";
import { PersonCard } from "@/components/person-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BackLink,
  Details,
  ErrorSummary,
  InsetText,
  NotificationBanner,
  PageHeading,
  SummaryList,
} from "@/components/ui/govuk";
import { Input } from "@/components/ui/input";
import { PartyLabel } from "@/components/ui/party-label";

// Living style guide. Not linked from the app; visit /design directly.
export const metadata: Metadata = {
  title: "Design system — Statesmen AI",
  robots: { index: false, follow: false },
};

const COLOURS = [
  { name: "Text", hex: "#0b0c0c" },
  { name: "Secondary text", hex: "#484949" },
  { name: "Link", hex: "#1a65a6" },
  { name: "Link hover", hex: "#0f385c" },
  { name: "Brand blue", hex: "#1d70b8" },
  { name: "Green (actions)", hex: "#0f7a52" },
  { name: "Red (errors)", hex: "#ca3535" },
  { name: "Focus yellow", hex: "#ffdd00" },
  { name: "Border", hex: "#cecece" },
  { name: "Light grey", hex: "#f3f3f3" },
  { name: "Surface", hex: "#f4f8fb" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t border-border pt-8">
      <h2 className="mb-5 text-l font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <>
      <PageHeading caption="Statesmen AI" size="xl">
        Design system
      </PageHeading>
      <p className="mt-5 max-w-[40rem] text-m">
        Built to GOV.UK Design System rules (colour, type, spacing, focus and
        components) without GOV.UK branding: Arial instead of GDS Transport,
        no crown, no GOV.UK logotype.
      </p>

      <Section title="Colour">
        <ul className="grid grid-cols-2 gap-5 tablet:grid-cols-4">
          {COLOURS.map((c) => (
            <li key={c.hex + c.name}>
              <div className="h-14 border border-border" style={{ backgroundColor: c.hex }} />
              <p className="mt-2 text-small font-bold">{c.name}</p>
              <p className="font-mono text-small text-muted-foreground">{c.hex}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <p className="text-xl font-bold">Heading XL 48px</p>
        <p className="mt-4 text-l font-bold">Heading L 36px</p>
        <p className="mt-4 text-m font-bold">Heading M 24px</p>
        <p className="mt-4 text-body font-bold">Heading S 19px</p>
        <p className="mt-4 text-m">Lead paragraph 24px</p>
        <p className="mt-4 text-body">Body 19px. We faced a global banking crisis, and we had to deal with it decisively.</p>
        <p className="mt-4 text-small">Body small 16px</p>
        <p className="mt-4 text-body">
          <a href="#" className="link">A link</a> — tab to it to see the yellow focus state.
        </p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-start gap-4">
          <Button variant="primary">Save and continue</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="warning">Delete</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="primary" size="lg">Start chat →</Button>
        </div>
      </Section>

      <Section title="Tags">
        <div className="flex flex-wrap gap-3">
          <Badge variant="blue">In progress</Badge>
          <Badge variant="green">Completed</Badge>
          <Badge variant="grey">Not started</Badge>
          <Badge variant="red">Failed</Badge>
          <Badge variant="yellow">Beta</Badge>
        </div>
        <div className="mt-5 flex flex-wrap gap-6 text-body">
          <PartyLabel party="Labour" color="#d50000" />
          <PartyLabel party="Conservative" color="#0063ba" />
          <PartyLabel party="Crossbench" color={null} />
        </div>
      </Section>

      <Section title="Form fields">
        <label htmlFor="demo-search" className="mb-2 block text-body font-bold">
          Search politicians
        </label>
        <Input id="demo-search" className="max-w-[30rem]" />
      </Section>

      <Section title="Patterns">
        <BackLink href="/design">Back</BackLink>
        <SummaryList
          className="mt-6 max-w-[40rem]"
          rows={[
            { key: "Party", value: <PartyLabel party="Labour" color="#d50000" /> },
            { key: "House", value: "House of Commons" },
            { key: "Years", value: "1983–2015" },
          ]}
        />
        <InsetText className="mt-6 max-w-[40rem]">
          Replies are AI-generated. They are not real statements.
        </InsetText>
        <Details summary="Speeches used for this answer" className="mt-6 max-w-[40rem]">
          <SourceCard
            date="17 November 2008"
            debate="G20 Summit"
            excerpt="When the right hon. and learned Gentleman was Chancellor, debt was 44 per cent. of GDP."
            href="https://hansard.parliament.uk"
          />
        </Details>
        <NotificationBanner title="Important" className="mt-6 max-w-[40rem]">
          Preparing this persona for the first time. It usually takes under a minute.
        </NotificationBanner>
        <ErrorSummary className="mt-6 max-w-[40rem]">
          <p>Speech search is unavailable. Please try again.</p>
        </ErrorSummary>
      </Section>

      <Section title="Person">
        <div className="grid max-w-[30rem] grid-cols-2 gap-5">
          <PersonCard id={1423} name="Boris Johnson" party="Conservative" partyColor="#0063ba" term="2019–2022" href="/design" />
          <PersonCard id="example" name="Gordon Brown" party="Labour" partyColor="#d50000" term="2007–2010" photoUrl={null} href="/design" />
        </div>
      </Section>

      <Section title="Chat">
        <div className="flex max-w-[40rem] flex-col gap-6">
          <ul className="flex flex-col gap-3">
            <li><StarterChip>How did you handle the 2008 banking crisis?</StarterChip></li>
            <li><StarterChip>What did you make of the G20 summit?</StarterChip></li>
          </ul>
          <UserMessage>How did you handle the 2008 banking crisis?</UserMessage>
          <PersonaMessage name="Gordon Brown">
            <p className="text-body">
              We faced a global banking crisis, and we had to deal with it
              decisively. The first thing to do was to provide liquidity to the
              banking system.
            </p>
          </PersonaMessage>
          <PersonaMessage name="Gordon Brown" pending />
          <ComposerDemo />
        </div>
      </Section>
    </>
  );
}
