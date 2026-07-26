import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic OS",
  description: "Which of my projects is currently misleading me?",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
