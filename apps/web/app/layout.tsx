import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Veritas Stack — Media Verification Workbench",
  description:
    "Verification workbench for synthetic and sourced media — provenance over prediction. Built for HackTM 2026 Defense Track.",
  openGraph: {
    title: "Veritas Stack",
    description:
      "A verification workbench for synthetic and sourced media. Every check emits a structured, signed finding — the output is an audit trail, not a confidence score.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
