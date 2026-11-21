import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Statesmen AI — Chat with British political figures",
  description:
    "Chat with AI personas of British Prime Ministers, MPs, and Lords past and present, grounded in real Hansard speeches.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      className="h-full"
    >
      {/* Page chrome lives in the route-group layouts: (site) for browsing,
          (chat) for the full-screen chat. */}
      <body className="min-h-full">{children}</body>
    </html>
  );
}
