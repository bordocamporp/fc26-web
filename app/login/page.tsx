"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="rounded-3xl border border-lime-400/30 bg-zinc-900 p-10 text-center shadow-2xl">
        <h1 className="text-5xl font-black text-lime-400">
          BORDO CAMPO
        </h1>

        <p className="mt-4 text-zinc-400">
          Accedi con Discord
        </p>

        <button
  onClick={() => signIn("discord", { callbackUrl: "/staff" })}
  className="mt-8 rounded-2xl bg-lime-400 px-8 py-4 font-bold text-black transition hover:scale-105"
>
  LOGIN DISCORD
</button>
      </div>
    </main>
  );
}