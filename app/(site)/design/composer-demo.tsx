"use client";

import { useState } from "react";

import { Composer } from "@/components/chat/composer";

/** Interactive composer for the style guide: toggles busy on send. */
export function ComposerDemo() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Composer
        value={value}
        onChange={setValue}
        onSend={() => {
          setValue("");
          setBusy(true);
          setTimeout(() => setBusy(false), 2500);
        }}
        onStop={() => setBusy(false)}
        busy={busy}
        label="Ask Gordon Brown a question"
      />
      <p className="text-small text-muted-foreground">
        Send to see the stop state for 2.5 seconds.
      </p>
    </div>
  );
}
