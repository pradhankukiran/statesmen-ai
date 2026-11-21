/**
 * App layout for chat: no site header or footer. The chat page owns the
 * whole viewport (its own compact header, scrolling messages, pinned
 * message box).
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh overflow-hidden">{children}</div>;
}
