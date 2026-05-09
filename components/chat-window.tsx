"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  slug: string;
  name: string;
  photoUrl?: string;
  suggestedStarters: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

// Markdown render config — minimal: no images, no raw HTML. Typography is
// driven by @tailwindcss/typography (prose) on the wrapping container; we
// only override the link target/rel here so external links open safely.
const markdownComponents: Components = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

// Memoised so streaming tokens only re-parse the bubble that's actively
// growing, not every assistant bubble in the list.
const AssistantMarkdown = memo(function AssistantMarkdown({
  text,
}: {
  text: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-neutral max-w-none dark:prose-invert sm:prose-base",
        // Brand-yellow blockquote accent — overrides the prose default
        // (muted neutral border) to keep the design system's chromatic anchor.
        "prose-blockquote:border-l-brand prose-blockquote:font-normal prose-blockquote:not-italic",
        // Tighten heading sizes so a stray h1/h2 from the model doesn't
        // dwarf the surrounding chat copy.
        "prose-headings:tracking-tight prose-h1:text-base prose-h2:text-base prose-h3:text-sm",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatWindow({ slug, name, photoUrl, suggestedStarters }: Props) {
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { slug },
      }),
    [slug],
  );

  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport,
  });

  const isBusy = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;

  // ─── Auto-scroll: pin to bottom only if user is already near bottom. ──────

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  const isNearBottom = useCallback(() => {
    if (typeof window === "undefined") return true;
    const distance =
      document.documentElement.scrollHeight -
      window.scrollY -
      window.innerHeight;
    return distance < 120;
  }, []);

  useEffect(() => {
    function onScroll() {
      stickRef.current = isNearBottom();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isNearBottom]);

  useLayoutEffect(() => {
    if (!stickRef.current) return;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
  }, [messages, status]);

  // ─── Input + send handlers ─────────────────────────────────────────────────

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || isBusy) return;
      stickRef.current = true;
      setInput("");
      void sendMessage({ text: trimmed });
    },
    [isBusy, sendMessage],
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit(input);
  }

  function handleStarter(starter: string) {
    submit(starter);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(input);
    }
  }

  // ─── Auto-grow textarea ────────────────────────────────────────────────────

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 220);
    el.style.height = `${next}px`;
  }, [input]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const canRetry = error !== undefined && messages.length > 0;

  return (
    <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl flex-col px-4 sm:px-6 lg:h-full lg:min-h-0 lg:overflow-hidden">
      {/* Persona header */}
      <header className="flex items-center gap-4 border-b border-border py-6 sm:py-8 lg:flex-shrink-0">
        <Avatar name={name} src={photoUrl} size="lg" loading="eager" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="truncate text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
            {name}
          </h1>
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            AI persona · Hansard-grounded
          </p>
        </div>
      </header>

      {/* Conversation — at lg+ this is the only scrollable region. */}
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
      {hasMessages ? (
        <ol className="flex flex-col gap-8 py-10 sm:py-12">
          {messages.map((message) => {
            const text = messageText(message);
            const isUser = message.role === "user";
            const isPendingAssistant =
              !isUser && text.length === 0 && isBusy;

            if (isUser) {
              return (
                <li key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-[0.9375rem] leading-relaxed text-foreground sm:max-w-[80%]">
                    {text}
                  </div>
                </li>
              );
            }

            const isStreaming =
              !isUser && status === "streaming" && message === messages[messages.length - 1];

            return (
              <li key={message.id} className="flex items-start gap-4">
                <Avatar name={name} src={photoUrl} size="sm" />
                <div
                  className="min-w-0 flex-1 py-1 text-[0.9375rem] leading-relaxed text-foreground sm:text-base"
                  aria-busy={isStreaming || undefined}
                >
                  {isPendingAssistant ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Thinking…
                    </span>
                  ) : (
                    <AssistantMarkdown text={text} />
                  )}
                </div>
              </li>
            );
          })}

          {status === "submitted" &&
          messages[messages.length - 1]?.role === "user" ? (
            <li className="flex items-start gap-4">
              <Avatar name={name} src={photoUrl} size="sm" />
              <div
                className="flex min-w-0 flex-1 items-center gap-2 py-1 text-[0.9375rem] leading-relaxed text-muted-foreground sm:text-base"
                aria-live="polite"
              >
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Thinking…
              </div>
            </li>
          ) : null}

          {error ? (
            <li className="flex items-start gap-4" role="alert">
              <Avatar name={name} src={photoUrl} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl bg-destructive/5 px-4 py-3.5 text-sm ring-1 ring-inset ring-destructive/20">
                <p className="text-destructive">
                  {error.message || "Something went wrong. Please try again."}
                </p>
                {canRetry ? (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => regenerate()}
                      disabled={isBusy}
                    >
                      <RefreshCw aria-hidden />
                      Retry
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ) : null}

          <div ref={bottomRef} aria-hidden />
        </ol>
      ) : (
        <EmptyState
          name={name}
          starters={suggestedStarters}
          onStarter={handleStarter}
          disabled={isBusy}
        />
      )}
      </div>

      {/* Composer — sticky on mobile (page scrolls); pinned by flex at lg+
          (the parent is overflow-hidden so sticky is a no-op there, but kept
          so the `before:` fade gradient still has a positioned ancestor). */}
      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-4 mt-auto bg-background pb-4 pt-3 sm:-mx-6 sm:pb-6",
          "before:pointer-events-none before:absolute before:-top-8 before:left-0 before:right-0 before:h-8 before:bg-gradient-to-b before:from-transparent before:to-background",
          "lg:mt-0 lg:flex-shrink-0",
        )}
      >
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-3xl px-4 sm:px-6"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${name}…`}
            aria-label={`Message ${name}`}
            rows={1}
            autoFocus
            disabled={isBusy}
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-lt-active="false"
            spellCheck={false}
            className={cn(
              "block w-full resize-none rounded-xl bg-card px-4 py-3 text-[0.9375rem] leading-relaxed",
              "outline-none ring-1 ring-inset ring-border transition-[box-shadow] placeholder:text-muted-foreground",
              "focus-visible:ring-2 focus-visible:ring-brand/50",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
            )}
            style={{ maxHeight: 220 }}
          />
        </form>
        <p className="mx-auto mt-3 max-w-3xl px-4 text-center text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:px-6">
          {isBusy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              {name} is writing…
            </span>
          ) : (
            <>Press Enter to send · Shift+Enter for newline · AI-generated, not actual statements by {name}.</>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  name,
  starters,
  onStarter,
  disabled,
}: {
  name: string;
  starters: string[];
  onStarter: (s: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-12 py-16 sm:py-24">
      <div className="flex flex-col items-start gap-5">
        <Badge variant="brand">Begin conversation</Badge>
        <h2 className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
          What would you like to ask {name}?
        </h2>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          A persona built from real Hansard speeches. Ask anything — about the
          time in office, a policy, a turn of phrase. Or pick a starter.
        </p>
      </div>

      <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {starters.map((starter) => (
          <li key={starter}>
            <button
              type="button"
              onClick={() => onStarter(starter)}
              disabled={disabled}
              className={cn(
                "rounded-full bg-card px-4 py-2.5 text-left text-sm font-medium text-foreground ring-1 ring-inset ring-border",
                "cursor-pointer transition-colors",
                "hover:bg-muted hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card",
              )}
            >
              {starter}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
