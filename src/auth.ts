import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { getDb } from "@/db";
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";
import { claimTripInvitesForUser } from "@/lib/supabase/collaborators";
import { claimGuestSubmissionsForUser } from "@/lib/supabase/guestIdentity";

function googleProvider() {
  const clientId = process.env.AUTH_GOOGLE_ID?.trim();
  const clientSecret = process.env.AUTH_GOOGLE_SECRET?.trim();
  if (!clientId || !clientSecret) {
    console.warn(
      "AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET missing — Google sign-in will not work.",
    );
  }
  return Google({
    clientId: clientId ?? "missing",
    clientSecret: clientSecret ?? "missing",
    allowDangerousEmailAccountLinking: true,
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  secret: process.env.AUTH_SECRET,
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
    error: "/login/error",
  },
  providers: [googleProvider()],
  events: {
    async signIn({ user }) {
      if (user.id && user.email) {
        try {
          await claimTripInvitesForUser(user.id, user.email);
        } catch (err) {
          console.error("claimTripInvitesForUser:", err);
        }
        try {
          await claimGuestSubmissionsForUser(user.id, user.email);
        } catch (err) {
          console.error("claimGuestSubmissionsForUser:", err);
        }
      }
    },
  },
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
