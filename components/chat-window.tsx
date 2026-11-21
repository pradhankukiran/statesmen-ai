"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowLeft, RefreshCw, SquarePen } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Composer } from "@/components/chat/composer";
import { PersonaMessage, UserMessage } from "@/components/chat/message";
import { StarterChip } from "@/components/chat/starter-chip";
import { GpuStatusDot } from "@/components/gpu-status-dot";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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

function messageText(message: UIMessage): string {
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
    <div className="prose prose-neutral max-w-none text-body text-foreground prose-p:my-3 first:prose-p:mt-0 last:prose-p:mb-0 prose-a:text-brand prose-blockquote:border-l-brand prose-blockquote:font-serif prose-headings:font-heading prose-headings:font-medium prose-h1:text-subheading prose-h2:text-subheading prose-h3:text-body">
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
    useChat({ transport });

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
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link href="/" aria-label="Back to all politicians" />}
          >
            <ArrowLeft />
          </Button>
          <Avatar name={name} src={photoUrl} size="md" loading="eager" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate font-heading text-subheading font-medium leading-tight">
              {name}
            </h1>
            {subtitle && (
              <p className="truncate text-small text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <GpuStatusDot />
          {hasMessages && (
            <Button variant="ghost" size="sm" onClick={newChat}>
              <SquarePen />
              <span className="hidden sm:inline">New chat</span>
            </Button>
          )}
        </div>
      </header>

      {/* Conversation */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
          {hasMessages ? (
            <ol className="flex flex-col gap-8">
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
                <li role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-destructive/5 p-4 ring-1 ring-inset ring-destructive/20">
                  <p className="text-small text-destructive">
                    {errorText(error)}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => regenerate()}
                    disabled={isBusy}
                  >
                    <RefreshCw />
                    Try again
                  </Button>
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

      {/* Message box */}
      <div className="shrink-0 border-t border-border bg-background">
        <div className="mx-auto w-full max-w-3xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Composer
            value={input}
            onChange={setInput}
            onSend={send}
            onStop={() => void stop()}
            busy={isBusy}
            placeholder={`Ask ${name} a question…`}
            autoFocus
          />
          <p className="mt-2 text-center text-label text-muted-foreground">
            AI-generated from Hansard speeches. Not real statements by {name}.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  name,
  photoUrl,
  starters,
  onStarter,
}: {
  name: string;
  photoUrl?: string;
  starters: string[];
  onStarter: (s: string) => void;
}) {
  return (
    <div className="my-auto flex flex-col items-center gap-8 py-8 text-center">
      <Avatar name={name} src={photoUrl} size="xl" loading="eager" />
      <div className="flex flex-col items-center gap-3">
        <h2 className="text-balance font-heading text-title font-medium">
          Ask {name} anything
        </h2>
        <p className="max-w-md text-body text-muted-foreground">
          Answers are drawn from their real speeches in Parliament.
        </p>
      </div>
      <ul className="grid w-full gap-2 sm:grid-cols-2">
        {starters.map((starter) => (
          <li key={starter} className="flex">
            <StarterChip className="w-full" onClick={() => onStarter(starter)}>
              {starter}
            </StarterChip>
          </li>
        ))}
      </ul>
    </div>
  );
}
