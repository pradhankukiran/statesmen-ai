"use client";

import { useId, useRef, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * GOV.UK-style question form: label, textarea, green Send button. The field
 * never disables, so typing and focus survive while a reply streams; during
 * a reply a grey Stop button appears. Enter sends; Shift+Enter adds a line.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy = false,
  label = "Your question",
  hint,
  autoFocus = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop?: () => void;
  busy?: boolean;
  label?: string;
  hint?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const id = useId();
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
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-body font-bold">
        {label}
      </label>
      {hint && <p className="-mt-1 text-small text-muted-foreground">{hint}</p>}
      <div className="flex items-end gap-3">
        <Textarea
          id={id}
          ref={fieldRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          autoFocus={autoFocus}
          spellCheck
          className="max-h-40"
        />
        {busy && onStop ? (
          <Button type="button" variant="secondary" onClick={onStop} className="mb-0.5">
            Stop
          </Button>
        ) : (
          <Button type="submit" variant="primary" disabled={!canSend} className="mb-0.5">
            Send
          </Button>
        )}
      </div>
    </form>
  );
}
