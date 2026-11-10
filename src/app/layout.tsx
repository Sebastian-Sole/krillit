import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import PlayerChip from "@/components/PlayerChip";
import "./globals.css";
import "./auth.css";

export const metadata: Metadata = {
  title: "Krillit",
  description: "Our Krillion leaderboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link href="/" className="brand">
              🦐 Krillit
            </Link>
            <nav>
              <Link href="/">Today</Link>
              <Link href="/stats">Stats</Link>
            </nav>
            <Suspense fallback={null}>
              <PlayerChip />
            </Suspense>
          </header>
          {children}
          <footer className="foot">
            Prompts, gem answers and worldwide averages come from{" "}
            <a href="https://krillion.io" target="_blank" rel="noreferrer">
              krillion.io
            </a>{" "}
            on the day. Krillion doesn&apos;t publish past days, so we only have them for days someone opened this site.{" "}
            <Link href="/admin">Admin</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
