import type { Metadata } from "next";
import { Suspense } from "react";
import { ADMIN_EMAIL, auth, authConfigured, isAdmin } from "@/auth";
import { signInWithGoogle, signOutAdmin, storedContent } from "./actions";
import { AdminEditor } from "./AdminEditor";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/**
 * The owner's dashboard: sign in with Google (only her account), edit any content section and
 * publish. The city and the résumé pick up the new content right away.
 */
export default function AdminPage() {
  return (
    <main className="min-h-dvh bg-[#120b2b] px-4 py-8 text-violet-50">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-extrabold text-white">Wouroud&apos;s City · Admin</h1>
        <Suspense fallback={<p className="mt-6 text-violet-200">Loading…</p>}>
          <Gate />
        </Suspense>
      </div>
    </main>
  );
}

async function Gate() {
  if (!authConfigured) {
    return (
      <section className="mt-6 rounded-2xl bg-white/5 p-6">
        <h2 className="text-xl font-bold text-white">Almost there</h2>
        <p className="mt-2">Sign-in isn&apos;t set up yet. Add these environment variables (in <code>.env</code> and in Vercel):</p>
        <ul className="mt-2 list-disc pl-6 font-mono text-sm">
          <li>AUTH_SECRET (any long random text)</li>
          <li>AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET (a Google OAuth client)</li>
          <li>MONGO_DB_URL (already in your .env)</li>
        </ul>
        <p className="mt-2 text-sm text-violet-200">
          Google OAuth redirect URLs: <code>https://wouroud-city.vercel.app/api/auth/callback/google</code> and{" "}
          <code>http://localhost:3000/api/auth/callback/google</code>
        </p>
      </section>
    );
  }
  const session = await auth();
  if (!(await isAdmin())) {
    return (
      <section className="mt-6 rounded-2xl bg-white/5 p-6">
        {session?.user?.email && <p className="mb-3 text-pink-200">{session.user.email} isn&apos;t allowed here.</p>}
        <p>Sign in with the owner&apos;s Google account ({ADMIN_EMAIL.replace(/(.).+(@.+)/, "$1…$2")}).</p>
        <form action={signInWithGoogle} className="mt-4">
          <button className="welcome-enter" type="submit">
            Sign in with Google
          </button>
        </form>
      </section>
    );
  }
  const { content, published } = await storedContent();
  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-violet-200">
          Signed in as {session?.user?.email} · {published ? `last published ${new Date(published).toLocaleString("en")}` : "showing the content from seed.ts (nothing published yet)"}
        </p>
        <form action={signOutAdmin}>
          <button className="hud-chip text-white" type="submit">
            Sign out
          </button>
        </form>
      </div>
      <AdminEditor content={content} />
    </section>
  );
}
