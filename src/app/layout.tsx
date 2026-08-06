import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";

import { auth } from "@/auth";
import { SiteChrome } from "@/components/SiteChrome";
import { appOrigin } from "@/lib/appOrigin";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "@/lib/brand";

import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
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
  let session = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }

  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${newsreader.variable}`}
    >
      <body>
        <SiteChrome session={session}>{children}</SiteChrome>
      </body>
    </html>
  );
}
