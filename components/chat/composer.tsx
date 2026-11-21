"use client";

import { ArrowUp, Square } from "lucide-react";
import { useRef, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Message box with a send button. The field never disables, so typing and
 * focus survive while a reply streams; during a reply the send button turns
 * into a stop button. Enter sends; Shift+Enter adds a line.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy = false,
  placeholder = "Ask a question…",
  autoFocus = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop?: () => void;
  busy?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = !busy && value.trim().length > 0;

  function send() {
    if (!canSend) return;
    onSend(value.trim());
    fieldRef.current?.focus();
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex items-end gap-2 rounded-lg bg-card p-1.5 ring-1 ring-input transition-shadow focus-within:ring-foreground/40",
        className,
      )}
    >
      <Textarea
        ref={fieldRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={1}
        autoFocus={autoFocus}
        spellCheck
        className="max-h-48 bg-transparent px-2 ring-0 focus-visible:ring-0"
      />
      {busy && onStop ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={onStop}
          aria-label="Stop reply"
        >
          <Square className="size-3.5 fill-current" />
        </Button>
      ) : (
        <Button
          type="submit"
          variant="primary"
          size="icon"
          disabled={!canSend}
          aria-label="Send"
        >
          <ArrowUp />
        </Button>
      )}
    </form>
  );
}
