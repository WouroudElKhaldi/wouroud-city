import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Sign-in for /admin: Google only, and only the owner's account gets in.
 * Needs AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET (and optionally ADMIN_EMAIL).
 */
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "wouroudelkhaldi@gmail.com").toLowerCase();

export const authConfigured = !!(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/admin", error: "/admin" },
  callbacks: {
    // Anyone else's Google account is turned away at the door.
    signIn: ({ profile }) => !!profile?.email && profile.email.toLowerCase() === ADMIN_EMAIL && profile.email_verified !== false,
  },
});

/** True when the current request is the owner's session. */
export async function isAdmin() {
  if (!authConfigured) return false;
  const session = await auth();
  return session?.user?.email?.toLowerCase() === ADMIN_EMAIL;
}
