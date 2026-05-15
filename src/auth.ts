import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import Resend from "next-auth/providers/resend";

import { getDb } from "@/db";
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";

const emailFrom =
  process.env.EMAIL_FROM ?? "Feige Gatherings <onboarding@resend.dev>";

function buildProviders(): NextAuthConfig["providers"] {
  const list: NextAuthConfig["providers"] = [];
  if (process.env.RESEND_API_KEY) {
    list.push(
      Resend({
        apiKey: process.env.RESEND_API_KEY,
        from: emailFrom,
      }),
    );
  } else {
    list.push(
      Nodemailer({
        server: {
          streamTransport: true,
          newline: "unix",
          buffer: true,
        } as Record<string, unknown>,
        from: emailFrom,
        async sendVerificationRequest({ identifier, url }) {
          console.log(
            `\n━━━ Feige Gatherings · magic link ━━━\nTo: ${identifier}\n${url}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
          );
        },
      }),
    );
  }
  return list;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  trustHost: true,
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login/error",
  },
  providers: buildProviders(),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
}));
