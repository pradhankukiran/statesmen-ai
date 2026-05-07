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
import { Loader2, RefreshCw } from "lucide-react";
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
// tab. Lists/bold/italic/code render with brand-consistent typography. Sized to
// match the landing-page's body copy (text-base/text-lg) so prose feels
// substantial, not chat-app-cramped.
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
    <p className="whitespace-pre-wrap leading-relaxed [&:not(:last-child)]:mb-4">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-4 list-disc space-y-1.5 pl-6 marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-1.5 pl-6 marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-brand pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  // Strip headings down to a sensible default — chamber answers occasionally
  // include them but they shouldn't dominate the bubble.
  h1: ({ children }) => (
    <p className="mb-2 text-lg font-semibold tracking-tight">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="mb-2 text-lg font-semibold tracking-tight">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="mb-2 text-base font-semibold tracking-tight">{children}</p>
  ),
};

// ─── Persona avatar (used in header + next to assistant messages) ────────────
//
// Sized up vs. earlier passes so it carries weight next to the larger
// type. Square-ish ring (1px) keeps it visually crisp without competing with
// the brutalist accent boxes elsewhere on the page.

function PersonaAvatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "sm" ? "size-9" : size === "lg" ? "size-14" : "size-12";
  const text =
    size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
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
    // Enter sends; Shift+Enter inserts a newline. The IME composition guard
    // prevents premature send while a user is mid-composition (Japanese,
    // Chinese, etc.).
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
    <div className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl flex-col px-4 sm:px-6">
      {/* ─ Persona header ─────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4 border-b-2 border-border py-6 sm:py-8">
        <PersonaAvatar name={name} photoUrl={photoUrl} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="truncate text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {name}
          </h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            AI persona · Hansard-grounded
          </p>
        </div>
      </header>

      {/* ─ Conversation ───────────────────────────────────────────────────── */}
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
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-md border-2 border-border bg-muted px-5 py-3 text-base leading-relaxed text-foreground sm:max-w-[80%]">
                    {text}
                  </div>
                </li>
              );
            }

            const isStreaming =
              !isUser && status === "streaming" && message === messages[messages.length - 1];

            return (
              <li key={message.id} className="flex items-start gap-4">
                <PersonaAvatar name={name} photoUrl={photoUrl} size="sm" />
                <div
                  className="min-w-0 flex-1 py-1 text-base leading-relaxed text-foreground sm:text-lg"
                  aria-busy={isStreaming || undefined}
                >
                  {isPendingAssistant ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
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
            <li className="flex items-start gap-4">
              <PersonaAvatar name={name} photoUrl={photoUrl} size="sm" />
              <div
                className="flex min-w-0 flex-1 items-center gap-2 py-1 text-base leading-relaxed text-muted-foreground sm:text-lg"
                aria-live="polite"
              >
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Thinking…
              </div>
            </li>
          ) : null}

          {error ? (
            <li className="flex items-start gap-4" role="alert">
              <PersonaAvatar name={name} photoUrl={photoUrl} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-md border-2 border-destructive/40 bg-destructive/5 px-5 py-4 text-base">
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
          "sticky bottom-0 z-10 -mx-4 mt-auto bg-background pb-4 pt-3 sm:-mx-6 sm:pb-6",
          "before:pointer-events-none before:absolute before:-top-8 before:left-0 before:right-0 before:h-8 before:bg-gradient-to-b before:from-transparent before:to-background",
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
            // Opt out of browser-extension overlays (Grammarly,
            // LanguageTool, etc.) injecting their own icons into the input.
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-lt-active="false"
            spellCheck={false}
            className={cn(
              // Bigger, squarer, bolder. Mirrors the SearchBar input on the
              // landing page in size + weight, but with a heavier border
              // since brutalism wants edges to read.
              "block w-full resize-none rounded-md border-2 border-input bg-background px-4 py-3 text-base leading-relaxed",
              "outline-none transition-colors placeholder:text-muted-foreground",
              // Brand-yellow only appears in the focus ring — neutral at rest.
              "focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-brand/50",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
            style={{ maxHeight: 220 }}
          />
        </form>
        <p className="mx-auto mt-3 max-w-3xl px-4 text-center text-xs uppercase tracking-widest text-muted-foreground sm:px-6">
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
//
// Stripped down to mirror the landing-page hero rhythm: brand-yellow pill,
// confident headline, supporting paragraph, then a short row of starter
// rectangles (NOT pills — corners stay sharp). Generous vertical padding so
// the eye lands on the headline first and the composer second.

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
      <div className="flex flex-col gap-6">
        <span className="inline-block w-fit bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
          Begin conversation
        </span>
        <h2 className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
          What would you like to ask {name}?
        </h2>
        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
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
                // Brutalist starter chip: bordered rectangle, sharp corners,
                // hover flips to brand-yellow background with black text.
                "rounded-md border-2 border-border bg-background px-4 py-3 text-left text-sm font-medium text-foreground sm:text-base",
                "transition-colors",
                "hover:border-foreground hover:bg-brand hover:text-brand-foreground",
                "focus-visible:outline-none focus-visible:border-foreground focus-visible:bg-brand focus-visible:text-brand-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background disabled:hover:text-foreground",
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
