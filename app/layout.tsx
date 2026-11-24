import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CalcSpace — Smart Calculator",
  description: "A clean calculator with useful everyday calculation tools.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
