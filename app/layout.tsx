import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Personal X Dashboard",
  description: "Private dashboard for your own X posts."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">
              <Link href="/" className="brand-title">
                Personal X Dashboard
              </Link>
            </div>
            <nav className="nav">
              <Link href="/">Posts</Link>
              <Link href="/posts/new">Add Post (Detailed)</Link>
              <Link href="/projects">Projects</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
