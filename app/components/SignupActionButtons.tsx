"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Club = {
  name: string;
  league: string | null;
  assigned_to: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignupActionButtons({
  requestId,
}: {
  requestId: number;
}) {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedLeague, setSelectedLeague] = useState("");
  const [selectedClub, setSelectedClub] = useState("");
  const [loading, setLoading] = useState<"accepted" | "rejected" | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function loadClubs() {
      const { data, error } = await supabase
        .from("fc26_clubs")
        .select("name, league, assigned_to")
        .order("league", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        console.error("Errore caricamento club:", error);
        setMessage("Errore caricamento club.");
        return;
      }

      const freeClubs =
        data?.filter((club) => !club.assigned_to || club.assigned_to === "") ??
        [];

      setClubs(freeClubs);

      const firstLeague = freeClubs[0]?.league || "Senza campionato";
      setSelectedLeague(firstLeague);
    }

    if (open) {
      loadClubs();
    }
  }, [open]);

  const groupedClubs = useMemo(() => {
    const grouped: Record<string, Club[]> = {};

    for (const club of clubs) {
      const league = club.league || "Senza campionato";

      if (!grouped[league]) {
        grouped[league] = [];
      }

      grouped[league].push(club);
    }

    return grouped;
  }, [clubs]);

  const leagues = Object.keys(groupedClubs);

  const selectedLeagueClubs = groupedClubs[selectedLeague] ?? [];

  async function sendAction(action: "accepted" | "rejected", clubName?: string) {
    setLoading(action);
    setMessage("");

    try {
      const response = await fetch("/api/signup-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request_id: requestId,
          action,
          club_name: clubName || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setMessage(result.message || "Errore durante l'azione.");
        return;
      }

      setMessage(result.message || "Azione inviata al bot Discord.");
      setOpen(false);
      router.refresh();
    } catch {
      setMessage("Errore di rete.");
    } finally {
      setLoading(null);
    }
  }

  const modal =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/90 p-6 backdrop-blur-xl">
            <div className="relative flex h-[86vh] w-[92vw] max-w-[1200px] flex-col overflow-hidden rounded-[2rem] border border-lime-400/40 bg-[#050805] shadow-[0_0_90px_rgba(132,204,22,0.35)]">
              <div className="flex items-start justify-between border-b border-white/10 p-7">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                    Assegna club
                  </p>

                  <h2 className="mt-3 text-4xl font-black text-white">
                    Scegli campionato e squadra
                  </h2>

                  <p className="mt-3 text-sm text-zinc-400">
                    I club vengono caricati direttamente da Supabase.
                  </p>
                </div>

                <button
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-black text-white hover:bg-white/20"
                >
                  ✕
                </button>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr] gap-6 p-7">
                <aside className="min-h-0 overflow-y-auto rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="grid gap-3">
                    {leagues.map((league) => (
                      <button
                        key={league}
                        onClick={() => {
                          setSelectedLeague(league);
                          setSelectedClub("");
                        }}
                        className={`rounded-2xl px-5 py-4 text-left font-black transition ${
                          selectedLeague === league
                            ? "bg-lime-400 text-black shadow-[0_0_30px_rgba(132,204,22,0.35)]"
                            : "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12]"
                        }`}
                      >
                        <div>{league}</div>
                        <div className="mt-1 text-xs opacity-70">
                          {groupedClubs[league]?.length ?? 0} club liberi
                        </div>
                      </button>
                    ))}

                    {!leagues.length && (
                      <p className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-zinc-400">
                        Nessun club libero trovato.
                      </p>
                    )}
                  </div>
                </aside>

                <section className="min-h-0 overflow-y-auto rounded-[1.5rem] border border-white/10 bg-black/35 p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-3xl font-black text-lime-400">
                      {selectedLeague || "Club"}
                    </h3>

                    <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-zinc-300">
                      {selectedLeagueClubs.length} disponibili
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedLeagueClubs.map((club) => (
                      <button
                        key={club.name}
                        onClick={() => setSelectedClub(club.name)}
                        className={`rounded-2xl border px-4 py-4 text-left font-black transition ${
                          selectedClub === club.name
                            ? "border-lime-400 bg-lime-400 text-black shadow-[0_0_25px_rgba(132,204,22,0.35)]"
                            : "border-white/10 bg-white/[0.05] text-white hover:border-lime-400/70 hover:bg-lime-400/10"
                        }`}
                      >
                        {club.name}
                      </button>
                    ))}

                    {!selectedLeagueClubs.length && (
                      <p className="col-span-full rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-zinc-400">
                        Nessun club disponibile in questo campionato.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 bg-black/50 p-7">
                <p className="text-zinc-300">
                  Club selezionato:{" "}
                  <span className="font-black text-lime-400">
                    {selectedClub || "nessuno"}
                  </span>
                </p>

                <button
                  disabled={!selectedClub || loading !== null}
                  onClick={() => sendAction("accepted", selectedClub)}
                  className="rounded-2xl bg-lime-400 px-8 py-4 font-black text-black transition hover:scale-105 disabled:opacity-40"
                >
                  {loading === "accepted"
                    ? "Invio al bot..."
                    : "Conferma accettazione"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <button
          disabled={loading !== null}
          onClick={() => setOpen(true)}
          className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-black text-black disabled:opacity-50"
        >
          Accetta
        </button>

        <button
          disabled={loading !== null}
          onClick={() => sendAction("rejected")}
          className="rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
        >
          {loading === "rejected" ? "Invio..." : "Rifiuta"}
        </button>
      </div>

      {message && (
        <p className="mt-2 text-xs text-zinc-400">
          {message}
        </p>
      )}

      {modal}
    </div>
  );
}