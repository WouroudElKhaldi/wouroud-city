import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ADMIN_EMAIL, authConfigured, isAdmin } from "@/auth";
import { guestbookNotes, signOutAdmin, storedContent } from "./actions";
import { AdminEditor } from "./AdminEditor";
import { GuestbookAdmin } from "./GuestbookAdmin";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/**
 * The owner's dashboard: sign in with her email and password, edit any content section and
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
  // Decide per request (never at build time, when the sign-in variables may not be there yet).
  await connection();
  if (!authConfigured) {
    return (
      <section className="mt-6 rounded-2xl bg-white/5 p-6">
        <h2 className="text-xl font-bold text-white">Almost there</h2>
        <p className="mt-2">Sign-in isn&apos;t set up yet. On your computer, in the project folder, run:</p>
        <pre className="mt-2 rounded-lg bg-black/40 p-3 text-sm">npm run admin:password</pre>
        <p className="mt-2">
          It asks for the password you want and prints <code>ADMIN_PASSWORD_HASH</code> and <code>AUTH_SECRET</code>. Put both in{" "}
          <code>.env</code> and in Vercel (Settings → Environment Variables), with <code>MONGO_DB_URL</code>, then restart or redeploy.
        </p>
      </section>
    );
  }
  if (!(await isAdmin())) {
    return (
      <section className="mt-6 rounded-2xl bg-white/5 p-6">
        <p>Sign in with the owner&apos;s account ({ADMIN_EMAIL.replace(/(.).+(@.+)/, "$1…$2")}).</p>
        <SignInForm />
      </section>
    );
  }
  const [{ content, published }, notes] = await Promise.all([storedContent(), guestbookNotes()]);
  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-violet-200">
          Signed in as {ADMIN_EMAIL} · {published ? `last published ${new Date(published).toLocaleString("en")}` : "showing the content from seed.ts (nothing published yet)"}
        </p>
        <form action={signOutAdmin}>
          <button className="hud-chip text-white" type="submit">
            Sign out
          </button>
        </form>
      </div>
      <AdminEditor content={content} />
      <GuestbookAdmin notes={notes} />
    </section>
  );
}
