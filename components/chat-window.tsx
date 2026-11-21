"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Composer } from "@/components/chat/composer";
import { PersonaMessage, UserMessage } from "@/components/chat/message";
import { SourceCard } from "@/components/chat/source-card";
import { StarterChip } from "@/components/chat/starter-chip";
import { GpuStatusDot } from "@/components/gpu-status-dot";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BackLink, Details, ErrorSummary } from "@/components/ui/govuk";
import {
  formatSourceDate,
  type ChatMetadata,
  type ReplySource,
} from "@/lib/chat-sources";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  slug: string;
  name: string;
  photoUrl?: string;
  /** Short line under the name, e.g. "Speeches 2005–2022". */
  subtitle?: string;
  suggestedStarters: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ChatMessage = UIMessage<ChatMetadata>;

function messageText(message: ChatMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

// Markdown: no images, no raw HTML; external links open safely.
const markdownComponents: Components = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

// Memoised so streaming only re-parses the reply that is growing.
const ReplyMarkdown = memo(function ReplyMarkdown({ text }: { text: string }) {
  return (
    <div className="prose max-w-none text-body text-foreground prose-p:my-3 prose-p:leading-[1.3158] first:prose-p:mt-0 last:prose-p:mb-0 prose-a:text-link prose-blockquote:border-l-[10px] prose-blockquote:border-border prose-blockquote:font-normal prose-blockquote:not-italic prose-headings:font-bold prose-h1:text-m prose-h2:text-m prose-h3:text-body prose-strong:font-bold">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

/**
 * Readable error text. Route errors arrive as the raw response body, e.g.
 * `{"error":"Speech search is unavailable…"}`; show just the message.
 */
function errorText(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error) return parsed.error;
  } catch {
    // Not JSON; fall through.
  }
  return error.message || "Something went wrong. Please try again.";
}

/** Distance from the bottom (px) within which new content keeps us pinned. */
const STICK_THRESHOLD = 120;

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatWindow({ slug, name, photoUrl, subtitle, suggestedStarters }: Props) {
  const [input, setInput] = useState("");

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { slug } }),
    [slug],
  );
  const { messages, sendMessage, setMessages, status, error, regenerate, stop } =
    useChat<ChatMessage>({ transport });

  const isBusy = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;

  // ─── Scrolling: follow new content only while the reader is at the bottom.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const send = useCallback(
    (text: string) => {
      stickRef.current = true;
      setInput("");
      void sendMessage({ text });
    },
    [sendMessage],
  );

  const newChat = useCallback(() => {
    void stop();
    setMessages([]);
    setInput("");
  }, [setMessages, stop]);

  const lastMessage = messages[messages.length - 1];
  const waitingForFirstToken =
    status === "submitted" && lastMessage?.role === "user";

  return (
    <div className="flex h-full flex-col">
      {/* Slim brand bar, same as the site header. */}
      <div className="shrink-0 bg-brand text-white">
        <div className="page-width flex items-center justify-between py-2">
          <Link
            href="/"
            className="text-body font-bold text-white no-underline hover:underline focus-visible:bg-focus focus-visible:text-foreground focus-visible:shadow-[0_-2px_var(--focus),0_4px_var(--foreground)] focus-visible:outline-none"
          >
            Statesmen AI
          </Link>
          <GpuStatusDot />
        </div>
      </div>

      {/* Person heading */}
      <header className="shrink-0 border-b border-border">
        <div className="page-width py-4">
          <BackLink href="/">All politicians</BackLink>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={name} src={photoUrl} size="lg" loading="eager" />
            <div className="min-w-0 flex-1">
              {subtitle && (
                <p className="truncate text-small text-muted-foreground">{subtitle}</p>
              )}
              <h1 className="truncate text-m font-bold">{name}</h1>
            </div>
            {hasMessages && (
              <Button variant="secondary" size="sm" onClick={newChat}>
                New chat
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Conversation */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="page-width flex min-h-full flex-col py-6">
          {hasMessages ? (
            <ol className="flex max-w-[40rem] flex-col gap-6">
              {messages.map((message) => {
                const text = messageText(message);
                if (message.role === "user") {
                  return (
                    <li key={message.id}>
                      <UserMessage>{text}</UserMessage>
                    </li>
                  );
                }
                return (
                  <li key={message.id}>
                    <PersonaMessage
                      name={name}
                      photoUrl={photoUrl}
                      pending={text.length === 0 && isBusy}
                    >
                      <ReplyMarkdown text={text} />
                      {text.length > 0 && (
                        <ReplySources sources={message.metadata?.sources} />
                      )}
                    </PersonaMessage>
                  </li>
                );
              })}

              {waitingForFirstToken && (
                <li aria-live="polite">
                  <PersonaMessage name={name} photoUrl={photoUrl} pending />
                </li>
              )}

              {error && (
                <li>
                  <ErrorSummary title="There is a problem">
                    <p className="mb-5">{errorText(error)}</p>
                    <Button
                      variant="secondary"
                      onClick={() => regenerate()}
                      disabled={isBusy}
                    >
                      Try again
                    </Button>
                  </ErrorSummary>
                </li>
              )}
            </ol>
          ) : (
            <EmptyState
              name={name}
              photoUrl={photoUrl}
              starters={suggestedStarters}
              onStarter={send}
            />
          )}
        </div>
      </div>

      {/* Question form */}
      <div className="shrink-0 border-t border-border bg-background">
        <div className="page-width pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Composer
            value={input}
            onChange={setInput}
            onSend={send}
            onStop={() => void stop()}
            busy={isBusy}
            label={`Ask ${name} a question`}
            autoFocus
            className="max-w-[40rem]"
          />
          <p className="mt-2 max-w-[40rem] text-small text-muted-foreground">
            Replies are AI-generated from Hansard speeches. They are not real
            statements by {name}.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Sources ──────────────────────────────────────────────────────────────────

/** The Hansard speeches a reply drew on, behind a GOV.UK details toggle. */
function ReplySources({ sources }: { sources?: ReplySource[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <Details
      summary={`Speeches used for this answer (${sources.length})`}
      className="mt-4 text-small"
    >
      <ol className="flex flex-col gap-5">
        {sources.map((s) => (
          <li key={s.id}>
            <SourceCard
              date={formatSourceDate(s.date)}
              debate={s.debate}
              excerpt={s.excerpt}
              href={s.url}
            />
          </li>
        ))}
      </ol>
    </Details>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  name,
  starters,
  onStarter,
}: {
  name: string;
  photoUrl?: string;
  starters: string[];
  onStarter: (s: string) => void;
}) {
  return (
    <div className="max-w-[40rem]">
      <p className="text-body">
        Ask {name} about anything they spoke on in Parliament. Each answer is
        drawn from their real speeches.
      </p>
      <h2 className="mt-6 mb-3 text-body font-bold">Try asking</h2>
      <ul className="flex flex-col gap-3">
        {starters.map((starter) => (
          <li key={starter}>
            <StarterChip onClick={() => onStarter(starter)}>{starter}</StarterChip>
          </li>
        ))}
      </ul>
    </div>
  );
}
