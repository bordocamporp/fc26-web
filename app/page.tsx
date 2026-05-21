// FILE COMPLETO app/page.tsx MODIFICATO

"use client";

import Image from "next/image";
import { getSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import AnalyticsTracker from "./components/AnalyticsTracker";

const slides = [
  {
    title: "ISCRIZIONE TORNEO BC FC",
    subtitle:
      "Partecipa al torneo ufficiale FC26 Bordo Campo. Squadre, mercato e dashboard manager.",
    image: "/slides/torneo-fc26.jpg",
    logo: "/logo-bc-fc.png",
    button: "/iscrizione",
    buttonText: "ISCRIVITI ORA",
  },
];

export default function Home() {
  return (
    <main>
      <section>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row md:mt-10">
          <a
            href="/iscrizione"
            className="w-full rounded-2xl bg-lime-400 px-8 py-4 text-center font-black text-black shadow-[0_0_35px_rgba(132,204,22,0.35)] transition hover:scale-105 sm:w-auto"
          >
            ISCRIVITI ORA
          </a>

          <a
            href="https://discord.gg/kB8Km94Kba"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-2xl border border-lime-400/40 bg-lime-400/10 px-8 py-4 text-center font-black text-lime-300 backdrop-blur transition hover:scale-105 hover:border-lime-400 hover:bg-lime-400/20 sm:w-auto"
          >
            ENTRA NEL DISCORD DEL TORNEO
          </a>
        </div>
      </section>
    </main>
  );
}
