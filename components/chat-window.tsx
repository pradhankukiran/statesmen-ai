"use client";

import {
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
import { ArrowUp, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

// Markdown render config — minimal: no images, no raw HTML, links open in a new
// tab. Lists/bold/italic/code render with brand-consistent typography.
const markdownComponents: Components = {
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4 hover:text-foreground"
    >
      {children}
    </a>
  ),
  p: ({ children }) => (
    <p className="whitespace-pre-wrap leading-relaxed [&:not(:last-child)]:mb-3">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 pl-5 marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-5 marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-brand pl-4 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
  // Strip headings down to a sensible default — chamber answers occasionally
  // include them but they shouldn't dominate the bubble.
  h1: ({ children }) => (
    <p className="mb-2 text-base font-semibold tracking-tight">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="mb-2 text-base font-semibold tracking-tight">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="mb-2 text-sm font-semibold tracking-tight">{children}</p>
  ),
};

// ─── Persona avatar (used in header + next to assistant messages) ────────────

function PersonaAvatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl?: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "size-8" : "size-11";
  const text = size === "sm" ? "text-xs" : "text-sm";
  return (
    <div
      className={cn(
        dim,
        "shrink-0 overflow-hidden rounded-full ring-1 ring-foreground/10",
        photoUrl ? "bg-muted" : "bg-brand text-brand-foreground",
      )}
      aria-hidden
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="size-full object-cover"
          loading="eager"
        />
      ) : (
        <span
          className={cn(
            "flex size-full items-center justify-center font-semibold",
            text,
          )}
        >
          {initials(name)}
        </span>
      )}
    </div>
  );
}

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

  // ─── Auto-scroll: pin to bottom only if user is already near bottom. ───────
  //
  // We track whether the user is within ~120px of the document bottom. When
  // they are, every render that includes new content (new messages or
  // streaming deltas) re-pins. When they've scrolled up to read history, we
  // leave them alone.

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

  // useLayoutEffect so we scroll before the browser paints, avoiding flicker
  // during streaming.
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
    // Enter sends; Shift+Enter inserts a newline. Only on non-mobile-ish — on
    // small screens the on-screen keyboard's "return" usually maps to Enter
    // and users expect newline insertion, so we only intercept when shift is
    // not held.
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
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = `${next}px`;
  }, [input]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const canRetry = error !== undefined && messages.length > 0;

  return (
    <div className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl flex-col px-4 sm:px-6">
      {/* ─ Persona header ─────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 border-b border-border/60 py-5 sm:py-6">
        <PersonaAvatar name={name} photoUrl={photoUrl} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-base font-semibold leading-tight tracking-tight sm:text-lg">
            {name}
          </h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            AI persona · Hansard-grounded
          </p>
        </div>
      </header>

      {/* ─ Conversation ───────────────────────────────────────────────────── */}
      {hasMessages ? (
        <ol className="flex flex-col gap-6 py-8">
          {messages.map((message) => {
            const text = messageText(message);
            const isUser = message.role === "user";
            const isPendingAssistant =
              !isUser && text.length === 0 && isBusy;

            if (isUser) {
              return (
                <li key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground sm:max-w-[80%]">
                    {text}
                  </div>
                </li>
              );
            }

            const isStreaming =
              !isUser && status === "streaming" && message === messages[messages.length - 1];

            return (
              <li key={message.id} className="flex items-start gap-3">
                <PersonaAvatar name={name} photoUrl={photoUrl} size="sm" />
                <div
                  className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-foreground"
                  aria-busy={isStreaming || undefined}
                >
                  {isPendingAssistant ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      Thinking…
                    </span>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {text}
                    </ReactMarkdown>
                  )}
                </div>
              </li>
            );
          })}

          {/* Show a "Thinking…" placeholder when the user's request is in
             flight but no assistant message has been added yet. Once
             streaming starts, the assistant message appears in `messages`
             and the in-bubble pending state takes over. */}
          {status === "submitted" &&
          messages[messages.length - 1]?.role === "user" ? (
            <li className="flex items-start gap-3">
              <PersonaAvatar name={name} photoUrl={photoUrl} size="sm" />
              <div
                className="flex min-w-0 flex-1 items-center gap-2 pt-0.5 text-sm leading-relaxed text-muted-foreground"
                aria-live="polite"
              >
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Thinking…
              </div>
            </li>
          ) : null}

          {error ? (
            <li className="flex items-start gap-3" role="alert">
              <PersonaAvatar name={name} photoUrl={photoUrl} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
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
                      <RefreshCw className="size-3.5" aria-hidden />
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

      {/* ─ Composer ───────────────────────────────────────────────────────────
         Sticky to the viewport bottom inside <main>. The pt-2 + bg gradient
         softens the transition between the last message and the composer
         while content scrolls beneath it. */}
      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-4 mt-auto bg-background pb-3 pt-2 sm:-mx-6 sm:pb-4",
          "before:pointer-events-none before:absolute before:-top-6 before:left-0 before:right-0 before:h-6 before:bg-gradient-to-b before:from-transparent before:to-background",
        )}
      >
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 sm:px-6"
        >
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${name}…`}
              aria-label={`Message ${name}`}
              rows={1}
              autoFocus
              className={cn(
                "block w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 pr-12 text-sm leading-relaxed",
                "outline-none transition-colors placeholder:text-muted-foreground",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
              style={{ maxHeight: 200 }}
            />
            <Button
              type="submit"
              size="icon-sm"
              disabled={isBusy || input.trim().length === 0}
              className={cn(
                "absolute bottom-2 right-2 rounded-full",
                "bg-brand text-brand-foreground hover:bg-brand/90",
                "disabled:bg-muted disabled:text-muted-foreground",
              )}
              aria-label="Send"
            >
              {isBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </form>
        <p className="mx-auto mt-2 max-w-3xl px-4 text-center text-[0.7rem] leading-relaxed text-muted-foreground sm:px-6">
          AI-generated. Not actual statements by {name}.
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
    <div className="flex flex-1 flex-col items-start justify-center gap-8 py-16 sm:py-24">
      <div className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center bg-brand px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-brand-foreground">
          Begin conversation
        </span>
        <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          What would you like to ask {name}?
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
          A persona built from real Hansard speeches. Ask anything — about the
          time in office, a policy, a turn of phrase. Or pick a starter.
        </p>
      </div>

      <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {starters.map((starter) => (
          <li key={starter}>
            <button
              type="button"
              onClick={() => onStarter(starter)}
              disabled={disabled}
              className={cn(
                "rounded-full border border-border bg-background px-4 py-2 text-left text-sm text-foreground",
                "transition-colors hover:border-foreground/40 hover:bg-muted",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                "disabled:cursor-not-allowed disabled:opacity-50",
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
