"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, Send, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatWindow({ slug, name, photoUrl, suggestedStarters }: Props) {
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { slug },
    }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  // Auto-scroll to the bottom on new messages or streamed deltas.
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed.length === 0 || isBusy) return;
    setInput("");
    void sendMessage({ text: trimmed });
  }

  function handleStarter(starter: string) {
    if (isBusy) return;
    void sendMessage({ text: starter });
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="mb-4 flex items-center gap-3 border-b pb-4">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-foreground/10">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`Portrait of ${name}`}
              className="size-full object-cover"
              loading="eager"
            />
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">
              {initials(name)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">
            {name}
          </h1>
          <Badge variant="outline" className="mt-1 self-start">
            <Sparkles className="size-3" aria-hidden />
            AI persona · Hansard-grounded
          </Badge>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 -mx-2 px-2">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 py-12 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              Start a conversation with the AI persona of{" "}
              <span className="font-medium text-foreground">{name}</span>. Try
              one of these openers:
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
              {suggestedStarters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => handleStarter(starter)}
                  disabled={isBusy}
                  className="rounded-full border border-border bg-background px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-4 py-2">
            {messages.map((message) => {
              const text = messageText(message);
              const isUser = message.role === "user";
              return (
                <li
                  key={message.id}
                  className={cn(
                    "flex",
                    isUser ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      isUser
                        ? "bg-muted text-foreground"
                        : "border border-border bg-background text-foreground",
                    )}
                  >
                    {text.length === 0 && !isUser && status === "streaming" ? (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                        Thinking…
                      </span>
                    ) : (
                      text
                    )}
                  </div>
                </li>
              );
            })}
            {error ? (
              <li className="flex justify-start" role="alert">
                <div className="max-w-[85%] rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                  {error.message || "Something went wrong. Please try again."}
                </div>
              </li>
            ) : null}
            <div ref={bottomRef} />
          </ol>
        )}
      </ScrollArea>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 mt-4 flex items-center gap-2 border-t bg-background pt-4"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${name}…`}
          aria-label={`Message ${name}`}
          disabled={isBusy}
          className="h-10"
          autoFocus
        />
        <Button
          type="submit"
          size="lg"
          disabled={isBusy || input.trim().length === 0}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          {isBusy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          <span className="sr-only">Send</span>
        </Button>
      </form>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        AI-generated responses. Not actual statements by {name}.
      </p>
    </div>
  );
}
