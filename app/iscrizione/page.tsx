"use client";

import Image from "next/image";
import { getSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";

type SignupStatus = {
  id: number;
  status: "pending" | "accepted" | "rejected";
  club_name?: string | null;
  created_at?: string;
  handled_at?: string | null;
};
const ACCEPTED_ROLE_ID = "1398332847655358554";
const SIGNUP_ROLE_ID = "1398323695558332604";
const DISCORD_INVITE_URL = "https://discord.gg/kB8Km94Kba";

function getUserRoles(user: any): string[] {
  const possibleRoles =
    user?.roles ||
    user?.guildRoles ||
    user?.discordRoles ||
    user?.member?.roles ||
    user?.profile?.roles ||
    [];

  if (!Array.isArray(possibleRoles)) return [];

  return possibleRoles.map((role: any) => String(role?.id || role));
}

function hasRole(user: any, roleId: string) {
  return getUserRoles(user).includes(roleId);
}


export default function IscrizionePage() {
  const [session, setSession] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");

  const [form, setForm] = useState({
    real_name: "",
    age: "",
    platform: "",
    game_id: "",
    club_preferences: "",
  });

  const [signup, setSignup] = useState<SignupStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const currentSession = await getSession();

        if (!currentSession?.user) {
          setAuthStatus("unauthenticated");
          setChecking(false);
          return;
        }

        setSession(currentSession);
        setAuthStatus("authenticated");

        const roles = getUserRoles(currentSession.user);

        // Se ha già il ruolo iscritti, non deve più vedere la pagina iscrizione.
        if (roles.includes(ACCEPTED_ROLE_ID)) {
          window.location.href = "/manager";
          return;
        }

        // Se ha il ruolo per iscriversi, mandalo direttamente nel server Discord.
        if (roles.includes(SIGNUP_ROLE_ID)) {
          window.location.href = DISCORD_INVITE_URL;
          return;
        }

        try {
          const response = await fetch("/api/signup-status", {
            cache: "no-store",
          });

          if (response.ok) {
            const result = await response.json();

            if (result?.signup) {
              setSignup(result.signup);

              if (result.signup.status === "accepted") {
                window.location.href = "/manager";
                return;
              }
            }
          }
        } catch {
          // Se l'API status non risponde, la pagina resta utilizzabile.
        }
      } finally {
        setChecking(false);
      }
    }

    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/signup-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          discord_id:
            session?.user?.discordId ||
            session?.user?.discord_id ||
            session?.user?.sub ||
            session?.user?.id ||
            "",

          discord_name:
            session?.user?.name ||
            session?.user?.username ||
            "Unknown",

          platform: form.platform,
          age: form.age,
          psn_id: form.game_id,
          preferred_clubs: form.club_preferences,
          mode: "fc26",
        }),
      });

      const result = await response.json();

      setMessage(result.message || "Operazione completata.");

      if (response.ok) {
        setSignup({
          id: result.request?.id || 0,
          status: "pending",
          created_at: new Date().toISOString(),
        });
      }
    } catch {
      setMessage("Errore durante l'invio della richiesta.");
    } finally {
      setLoading(false);
    }
  }

  if (checking || authStatus === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020403] text-white">
        <div className="rounded-[2rem] border border-lime-400/20 bg-white/[0.04] p-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-lime-400">
            Bordo Campo
          </p>
          <h1 className="mt-4 text-4xl font-black">Controllo iscrizione...</h1>
        </div>
      </main>
    );
  }

  if (authStatus === "authenticated" && signup?.status === "accepted") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020403] px-6 text-white">
        <div className="max-w-xl rounded-[2rem] border border-lime-400/30 bg-lime-400/10 p-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-lime-400">
            Iscrizione accettata
          </p>

          <h1 className="mt-4 text-5xl font-black">
            Sei già iscritto
          </h1>

          <p className="mt-4 text-zinc-300">
            Verrai indirizzato automaticamente alla tua Area Manager.
          </p>

          <a
            href="/manager"
            className="mt-8 inline-flex rounded-2xl bg-lime-400 px-8 py-4 font-black text-black"
          >
            Vai all'Area Manager
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#020403] px-6 py-12 text-white">
      <div className="fixed left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-lime-400/20 blur-[140px]" />
      <div className="fixed bottom-[-180px] right-[-120px] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between gap-6">
          <a href="/" className="flex items-center gap-4">
            <Image
              src="/logo-bordo-campo.png"
              alt="Bordo Campo"
              width={54}
              height={54}
            />

            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                Bordo Campo
              </p>
              <h1 className="text-2xl font-black tracking-widest">
                ISCRIZIONE FC
              </h1>
            </div>
          </a>

          <a
            href="/"
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black text-zinc-300 transition hover:border-lime-400 hover:text-lime-400"
          >
            Torna alla Home
          </a>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[2.5rem] border border-lime-400/20 bg-gradient-to-br from-lime-400/15 via-white/[0.04] to-black p-9 shadow-[0_0_80px_rgba(132,204,22,0.10)]">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-lime-400">
              BC FC League
            </p>

            <h2 className="mt-4 text-5xl font-black leading-none md:text-7xl">
              Iscriviti al Torneo FC
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300">
              Entra nella lega Bordo Campo: richiesta dal sito o da Discord,
              controllo staff, assegnazione club e dashboard manager con rosa FC26.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <InfoCard title="1" text="Login Discord" />
              <InfoCard title="2" text="Invio richiesta" />
              <InfoCard title="3" text="Staff approva" />
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl">
            {authStatus !== "authenticated" && (
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                  Accesso richiesto
                </p>

                <h3 className="mt-3 text-4xl font-black">
                  Accedi con Discord
                </h3>

                <p className="mt-4 text-zinc-400">
                  Per inviare la richiesta devi prima collegare il tuo account Discord.
                </p>

                <button
                  onClick={() => signIn("discord", { callbackUrl: "/iscrizione" })}
                  className="mt-8 w-full rounded-2xl bg-lime-400 px-8 py-4 font-black text-black shadow-[0_0_35px_rgba(132,204,22,0.35)] transition hover:scale-105"
                >
                  Login Discord
                </button>
              </div>
            )}

            {authStatus === "authenticated" && signup?.status === "pending" && (
              <StatusBox
                color="orange"
                title="Richiesta in attesa"
                text="La tua richiesta è stata inviata. Lo staff la controllerà appena possibile."
                buttonLabel="Torna alla Home"
                href="/"
              />
            )}

            {authStatus === "authenticated" && signup?.status === "rejected" && (
              <StatusBox
                color="red"
                title="Richiesta rifiutata"
                text="La tua richiesta è stata rifiutata. Puoi contattare lo staff su Discord per maggiori informazioni."
                buttonLabel="Vai su Discord"
                href={DISCORD_INVITE_URL}
              />
            )}

            {authStatus === "authenticated" && !signup && (
              <form onSubmit={submit} className="grid gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                    Form iscrizione
                  </p>

                  <h3 className="mt-3 text-4xl font-black">
                    Dati player
                  </h3>

                  <p className="mt-3 text-sm text-zinc-400">
                    Account collegato: {session?.user?.name}
                  </p>
                </div>

                <Input
                  label="Nome"
                  value={form.real_name}
                  onChange={(v) => setForm({ ...form, real_name: v })}
                />

                <Input
                  label="Età"
                  value={form.age}
                  onChange={(v) => setForm({ ...form, age: v })}
                />

                <Input
                  label="Piattaforma"
                  placeholder="PS5, Xbox, PC..."
                  value={form.platform}
                  onChange={(v) => setForm({ ...form, platform: v })}
                />

                <Input
                  label="ID gioco / EA ID"
                  value={form.game_id}
                  onChange={(v) => setForm({ ...form, game_id: v })}
                />

                <Input
                  label="Club preferiti"
                  placeholder="Esempio: Milan, Arsenal, Real Madrid"
                  value={form.club_preferences}
                  onChange={(v) => setForm({ ...form, club_preferences: v })}
                />

                <button
                  disabled={loading}
                  className="rounded-2xl bg-lime-400 px-8 py-4 font-black text-black shadow-[0_0_35px_rgba(132,204,22,0.25)] transition hover:scale-105 disabled:opacity-50"
                >
                  {loading ? "Invio..." : "Invia richiesta"}
                </button>

                {message && (
                  <p className="rounded-2xl border border-white/10 bg-black/40 p-4 text-zinc-300">
                    {message}
                  </p>
                )}
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
      <p className="text-4xl font-black text-lime-400">{title}</p>
      <p className="mt-2 text-sm font-bold text-zinc-300">{text}</p>
    </div>
  );
}

function StatusBox({
  color,
  title,
  text,
  buttonLabel,
  href,
}: {
  color: "orange" | "red";
  title: string;
  text: string;
  buttonLabel: string;
  href: string;
}) {
  const styles = {
    orange: "border-orange-400/30 bg-orange-400/10 text-orange-400",
    red: "border-red-400/30 bg-red-400/10 text-red-400",
  };

  return (
    <div className={`rounded-[2rem] border p-7 ${styles[color]}`}>
      <p className="text-xs font-black uppercase tracking-[0.35em]">
        Stato iscrizione
      </p>

      <h3 className="mt-3 text-4xl font-black text-white">
        {title}
      </h3>

      <p className="mt-4 text-zinc-300">
        {text}
      </p>

      <a
        href={href}
        className="mt-8 inline-flex rounded-2xl bg-lime-400 px-7 py-4 font-black text-black"
      >
        {buttonLabel}
      </a>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-zinc-300">{label}</span>

      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-2xl border border-white/10 bg-black/50 px-5 py-4 outline-none transition focus:border-lime-400"
      />
    </label>
  );
}
