import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Page chrome lives in the route-group layouts: (site) for browsing,
          (chat) for the full-screen chat. */}
      <body className="min-h-full">{children}</body>
    </html>
  );
}
