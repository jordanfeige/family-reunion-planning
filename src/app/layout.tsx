import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";

import { auth } from "@/auth";
import { SiteChrome } from "@/components/SiteChrome";
import { appOrigin } from "@/lib/appOrigin";

import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Feige Gatherings — Family reunion magic",
    template: "%s · Feige Gatherings",
  },
  description:
    "Plan Feige family reunions with surveys, AI trip ideas, shareable options, and a living gallery.",
  metadataBase: new URL(appOrigin()),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable}`}>
      <body>
        <SiteChrome session={session}>{children}</SiteChrome>
      </body>
    </html>
  );
}
