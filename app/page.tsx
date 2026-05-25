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
  {
    title: "BORDO CAMPO DISCORD",
    subtitle:
      "Entra nella community ufficiale per seguire LIVE, aggiornamenti, tornei e contenuti gaming.",
    image: "/slides/bordo-campo-discord.jpg",
    logo: "/logo-bordo-campo.png",
    button: "https://discord.gg/racNPznyy9",
    buttonText: "ENTRA NEL DISCORD",
  },
  {
    title: "FIVEM REAL RP",
    subtitle:
      "Vivi l'esperienza roleplay definitiva nel server Real RP targato Bordo Campo.",
    image: "/slides/server-rp.jpg",
    logo: "/logo-rp.png",
    button: "https://discord.gg/FF7HbtXZ7k",
    buttonText: "SCOPRI REAL RP",
  },
];

const navItems = [
  ["HOME", "/"],
  ["Torneo", "/torneo"],
  ["Calcio", "/calcio"],
  ["Pro Club", "https://discord.gg/suRj5EgZVq"],
  ["Discord", "https://discord.gg/racNPznyy9"],
];

const cards = [
  {
    title: "TORNEO BC FC",
    desc: "Classifiche, calendario, rose, mercato e competizioni FC26.",
    visual: "from-lime-400/40 via-emerald-500/20 to-black",
    badge: "FC26",
  },
  {
    title: "CALCIO",
    desc: "News, mercato, risultati e approfondimenti sul calcio reale.",
    visual: "from-green-500/35 via-lime-400/15 to-black",
    badge: "CALCIO",
  },
  {
    title: "PRO CLUB",
    desc: "FC Pro Club, team competitivi, tornei ed esperienza community.",
    visual: "from-violet-500/35 via-cyan-400/15 to-black",
    badge: "PRO CLUB",
  },
];

export default function Home() {
  const [slide, setSlide] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlide((prev) => (prev + 1) % slides.length);
    }, 4500);

    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);

    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    async function loadSession() {
      const currentSession = await getSession();
      setSession(currentSession);
      setAuthLoaded(true);
    }

    loadSession();
  }, []);

  const current = slides[slide];

  return (
    <main className="min-h-screen overflow-hidden bg-[#030504] text-white">
      <AnalyticsTracker page="home" />

      <div className="pointer-events-none fixed left-[-200px] top-[-200px] h-[500px] w-[500px] rounded-full bg-lime-400/20 blur-[160px]" />
      <div className="pointer-events-none fixed bottom-[-220px] right-[-180px] h-[520px] w-[520px] rounded-full bg-emerald-500/20 blur-[170px]" />

      <header
        className={`fixed left-0 top-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? "border-b border-lime-400/20 bg-black/80 py-3 shadow-[0_0_40px_rgba(132,204,22,0.12)] backdrop-blur-2xl"
            : "bg-transparent py-6"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 md:px-6">
          <a href="/" className="flex items-center gap-2 md:gap-4">
            <Image
              src="/logo-bordo-campo.png"
              alt="Bordo Campo"
              width={54}
              height={54}
            />

            <div>
              <h1 className="text-sm font-black tracking-[0.15em] md:text-xl md:tracking-[0.2em]">
                BORDO CAMPO
              </h1>

              <p className="text-xs text-zinc-400">
                Football • Pro Club • Esports
              </p>

              <a
                href="https://discord.gg/racNPznyy9"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex animate-pulse items-center gap-2 rounded-2xl border border-red-400/40 bg-red-500/20 px-4 py-2 text-xs font-black uppercase tracking-wider text-red-200 shadow-[0_0_25px_rgba(239,68,68,0.45)] transition hover:scale-105 hover:bg-red-500/35"
              >
                <span className="h-2 w-2 rounded-full bg-red-300" />
                ENTRA NELLA LIVE
              </a>
            </div>
          </a>

          <div className="hidden items-center gap-5 lg:flex">
            <nav className="flex items-center gap-5 text-sm font-bold">
              {navItems.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target={String(href).startsWith("http") ? "_blank" : undefined}
                  rel={String(href).startsWith("http") ? "noopener noreferrer" : undefined}
                  className="relative transition hover:text-lime-400"
                >
                  {label}
                </a>
              ))}
            </nav>

            {authLoaded && (
              <a
                href={session?.user ? "/manager" : "/iscrizione"}
                className="rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-black shadow-[0_0_30px_rgba(132,204,22,0.35)] transition hover:scale-105"
              >
                {session?.user ? "AREA MANAGER" : "ISCRIVITI AL TORNEO FC"}
              </a>
            )}

            <div className="h-7 w-px bg-white/10" />

            {!authLoaded && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-zinc-400">
                ...
              </div>
            )}

            {authLoaded && !session?.user && (
              <button
                onClick={() => signIn("discord", { callbackUrl: "/" })}
                className="rounded-2xl border border-[#5865F2]/50 bg-[#5865F2]/20 px-5 py-3 text-sm font-black text-white transition hover:bg-[#5865F2]"
              >
                LOGIN DISCORD
              </button>
            )}

            {authLoaded && session?.user && (
              <div className="flex items-center gap-3">
                <a
                  href="/manager"
                  className="max-w-[170px] truncate rounded-2xl border border-lime-400/30 bg-lime-400/10 px-5 py-3 text-sm font-black text-lime-300 transition hover:border-lime-400"
                  title={session.user.name || "Account"}
                >
                  {session.user.name || "Account"}
                </a>

                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-3 text-sm font-black text-red-300 transition hover:border-red-400 hover:bg-red-400/20"
                >
                  LOGOUT
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-xl font-black text-lime-400 backdrop-blur lg:hidden"
            aria-label="Apri menu"
          >
            {mobileMenuOpen ? "×" : "☰"}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="mx-auto mt-4 max-w-7xl px-4 lg:hidden">
            <div className="rounded-[1.5rem] border border-lime-400/20 bg-black/90 p-4 shadow-[0_0_40px_rgba(132,204,22,0.12)] backdrop-blur-2xl">
              <nav className="grid gap-2">
                {navItems.map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    target={String(href).startsWith("http") ? "_blank" : undefined}
                    rel={String(href).startsWith("http") ? "noopener noreferrer" : undefined}
                    className="rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-wider text-white/80 transition hover:bg-lime-400 hover:text-black"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {label}
                  </a>
                ))}
              </nav>

              <div className="mt-4 grid gap-3 border-t border-white/10 pt-4">
                {authLoaded && (
                  <a
                    href={session?.user ? "/manager" : "/iscrizione"}
                    className="rounded-2xl bg-lime-400 px-5 py-3 text-center text-sm font-black text-black"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {session?.user ? "AREA MANAGER" : "ISCRIVITI AL TORNEO FC"}
                  </a>
                )}

                {authLoaded && !session?.user && (
                  <button
                    onClick={() => signIn("discord", { callbackUrl: "/" })}
                    className="rounded-2xl border border-[#5865F2]/50 bg-[#5865F2]/20 px-5 py-3 text-sm font-black text-white"
                  >
                    LOGIN DISCORD
                  </button>
                )}

                {authLoaded && session?.user && (
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-3 text-sm font-black text-red-300"
                  >
                    LOGOUT
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <section className="relative min-h-screen">
        <div
          className="absolute inset-0 bg-black bg-cover bg-center bg-no-repeat transition-all duration-1000 md:bg-contain"
          style={{ backgroundImage: `url('${current.image}')` }}
        />

        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/25" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(132,204,22,0.18),transparent_35%)]" />

        <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-4 pt-24 md:px-6 md:pt-28 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-5 text-sm font-black uppercase tracking-[0.45em] text-lime-400">
              Live Esports Portal
            </p>

            <h2 className="max-w-4xl text-4xl font-black leading-none sm:text-5xl md:text-7xl lg:text-8xl">
              {current.title}
            </h2>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-300 md:mt-8 md:text-xl">
              {current.subtitle}
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row md:mt-10">
              <a
                href={current.button}
                target={current.button.startsWith("http") ? "_blank" : undefined}
                rel={current.button.startsWith("http") ? "noopener noreferrer" : undefined}
                className="w-full rounded-2xl bg-lime-400 px-8 py-4 text-center font-black text-black shadow-[0_0_35px_rgba(132,204,22,0.35)] transition hover:scale-105 sm:w-auto"
              >
                {current.buttonText}
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

            <div className="mt-12 flex gap-3">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setSlide(index)}
                  className={`h-2 rounded-full transition-all ${
                    slide === index
                      ? "w-12 bg-lime-400"
                      : "w-6 bg-white/30"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="hidden justify-center lg:flex">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-lime-400/30 blur-[80px]" />

              <Image
                src={current.logo}
                alt={current.title}
                width={430}
                height={430}
                priority
                className="relative z-10 max-h-[430px] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 overflow-hidden border-y border-lime-400/20 bg-lime-400/10 py-4">
        <div className="flex w-max animate-[marquee_18s_linear_infinite] gap-16 whitespace-nowrap px-6 text-sm font-black uppercase tracking-[0.35em] text-lime-300">
          <span>BENVENUTO SU BORDO CAMPO</span>
          <span>BENVENUTO SU BORDO CAMPO</span>
          <span>BENVENUTO SU BORDO CAMPO</span>
          <span>BENVENUTO SU BORDO CAMPO</span>
        </div>

        <style jsx>{`
          @keyframes marquee {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
        `}</style>
      </section>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-8 px-6 py-20 lg:grid-cols-[240px_1fr]">
        <aside className="hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl lg:block">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
            Competizione Online
          </p>

          <div className="mt-8 grid gap-3">
            {[
              "Classifiche",
              "Calendari",
              "News",
            ].map((item, index) => (
              <div
                key={item}
                className={`rounded-2xl px-5 py-4 font-bold ${
                  index === 0
                    ? "bg-lime-400 text-black"
                    : "bg-white/[0.04] text-white/70"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div>
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="font-black uppercase tracking-[0.35em] text-lime-400">
                Explore
              </p>

              <h3 className="mt-3 text-3xl font-black md:text-5xl">
                Esplora il nostro sito
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {cards.map((card) => (
              <div
                key={card.title}
                className="group overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl transition duration-300 hover:-translate-y-2 hover:border-lime-400/60 hover:shadow-[0_0_50px_rgba(132,204,22,0.16)]"
              >
                <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${card.visual}`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.22),transparent_28%)]" />
                  <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/20 bg-white/10 blur-sm transition duration-500 group-hover:scale-125" />
                  <div className="absolute bottom-5 left-6 rounded-2xl border border-white/15 bg-black/40 px-5 py-3 text-2xl font-black tracking-widest text-white backdrop-blur">
                    {card.badge}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                </div>

                <div className="p-8">
                  <div className="mb-8 h-1 w-16 rounded-full bg-lime-400 transition group-hover:w-28" />

                  <h4 className="text-3xl font-black">
                    {card.title}
                  </h4>

                  <p className="mt-4 leading-relaxed text-zinc-400">
                    {card.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-10 md:flex-row md:px-6">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-bordo-campo.png"
              alt="BC"
              width={42}
              height={42}
            />

            <span className="font-black tracking-widest">
              BORDO CAMPO
            </span>
          </div>

          <p className="text-sm text-zinc-500">
            © 2026 Bordo Campo
          </p>
        </div>
      </footer>
    </main>
  );
}
