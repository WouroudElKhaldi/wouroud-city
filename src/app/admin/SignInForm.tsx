"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

/** Email and password for the owner. */
export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null });
  return (
    <form action={action} className="mt-4 flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-violet-200">
        Email
        <input name="email" type="email" autoComplete="username" required className="rounded-lg bg-white/10 px-3 py-2 text-white" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-violet-200">
        Password
        <input name="password" type="password" autoComplete="current-password" required className="rounded-lg bg-white/10 px-3 py-2 text-white" />
      </label>
      <button className="welcome-enter" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-pink-200">
          {state.error}
        </p>
      )}
    </form>
  );
}
