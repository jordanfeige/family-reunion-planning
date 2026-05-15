import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";

import { auth } from "@/auth";
import { SiteChrome } from "@/components/SiteChrome";
import { appOrigin } from "@/lib/appOrigin";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "@/lib/brand";

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
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  metadataBase: new URL(appOrigin()),
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
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
