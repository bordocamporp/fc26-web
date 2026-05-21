"use client";

import { useEffect, useMemo, useState } from "react";

type Player = {
  id: string | number;
  name: string;
  position?: string | null;
  overall?: number | string | null;
  team?: string | null;
};

type Match = {
  id: string | number;
  source_table: string;
  competition_name: string;
  competition_type: string;
  round?: string | null;
  leg?: string | null;
  home_user_id?: string | null;
  away_user_id?: string | null;
  home_club: string;
  away_club: string;
  home_players: Player[];
  away_players: Player[];
};

type Scorer = {
  player_id: string;
  player_name: string;
  club_name: string;
  goals: number;
};

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function PlayerCard({
  player,
  club,
  selectedGoals,
  onChange,
}: {
  player: Player;
  club: string;
  selectedGoals: number;
  onChange: (goals: number) => void;
}) {
  const initials = player.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`rounded-[1.6rem] border p-4 transition ${
        selectedGoals > 0
          ? "border-lime-400 bg-lime-400/10 shadow-[0_0_30px_rgba(132,204,22,0.18)]"
          : "border-white/10 bg-white/[0.035] hover:border-lime-400/40"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg font-black text-lime-400">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-white">{player.name}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
            {player.position || "Player"} {player.overall ? `• OVR ${player.overall}` : ""}
          </p>
          <p className="mt-1 truncate text-xs text-zinc-400">{club}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, selectedGoals - 1))}
          className="h-10 w-10 rounded-xl bg-white/10 text-xl font-black text-white transition hover:bg-red-400 hover:text-black"
        >
          -
        </button>

        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
            Gol
          </p>
          <p className="text-2xl font-black text-lime-400">{selectedGoals}</p>
        </div>

        <button
          type="button"
          onClick={() => onChange(Math.min(12, selectedGoals + 1))}
          className="h-10 w-10 rounded-xl bg-lime-400 text-xl font-black text-black transition hover:scale-105"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function ManagerRisultatiPage() {
  const [sessionUserId, setSessionUserId] = useState<string>("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [homeGoals, setHomeGoals] = useState<Record<string, number>>({});
  const [awayGoals, setAwayGoals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
      const session = await sessionRes.json();
      const userId =
        session?.user?.id ||
        session?.user?.discordId ||
        session?.user?.providerAccountId ||
        "";

      setSessionUserId(String(userId || ""));

      const dataRes = await fetch(
        `/api/manager/risultati-data?userId=${encodeURIComponent(String(userId || ""))}`,
        { cache: "no-store" }
      );

      const data = await dataRes.json();

      if (!dataRes.ok) {
        throw new Error(data?.error || "Errore caricamento partite.");
      }

      setMatches(data.matches || []);

      if (data.matches?.length && !selectedMatchId) {
        setSelectedMatchId(String(data.matches[0].id));
      }
    } catch (error: any) {
      setMessage(`❌ ${error.message || "Errore caricamento."}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMatch = useMemo(
    () => matches.find((match) => String(match.id) === String(selectedMatchId)),
    [matches, selectedMatchId]
  );

  const homeTotal = useMemo(
    () => Object.values(homeGoals).reduce((sum, goals) => sum + Number(goals || 0), 0),
    [homeGoals]
  );

  const awayTotal = useMemo(
    () => Object.values(awayGoals).reduce((sum, goals) => sum + Number(goals || 0), 0),
    [awayGoals]
  );

  function scorersFromMap(players: Player[], goalsMap: Record<string, number>, club: string) {
    return players
      .map((player) => ({
        player_id: String(player.id),
        player_name: player.name,
        club_name: club,
        goals: Number(goalsMap[String(player.id)] || 0),
      }))
      .filter((item) => item.goals > 0);
  }

  async function submitResult() {
    if (!selectedMatch) return;

    const homeScorers = scorersFromMap(
      selectedMatch.home_players,
      homeGoals,
      selectedMatch.home_club
    );
    const awayScorers = scorersFromMap(
      selectedMatch.away_players,
      awayGoals,
      selectedMatch.away_club
    );

    if (homeTotal === 0 && awayTotal === 0) {
      setMessage("❌ Inserisci almeno un marcatore prima di inviare.");
      return;
    }

    if (homeScorers.reduce((s, p) => s + p.goals, 0) !== homeTotal) {
      setMessage("❌ Errore nel conteggio marcatori casa.");
      return;
    }

    if (awayScorers.reduce((s, p) => s + p.goals, 0) !== awayTotal) {
      setMessage("❌ Errore nel conteggio marcatori trasferta.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/manager/risultati-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: sessionUserId,
          match: selectedMatch,
          home_score: homeTotal,
          away_score: awayTotal,
          scorers: [...homeScorers, ...awayScorers],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Errore invio risultato.");
      }

      setMessage(
        "✅ Risultato inviato. Ora deve essere confermato dall’avversario su Discord."
      );
      setHomeGoals({});
      setAwayGoals({});
      await load();
    } catch (error: any) {
      setMessage(`❌ ${error.message || "Errore invio risultato."}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-lime-400/20 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.18),transparent_35%),linear-gradient(180deg,#050505,#000)] px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                Area Manager
              </p>
              <h1 className="mt-3 text-4xl font-black uppercase leading-none md:text-7xl">
                Inserisci risultato
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-zinc-400 md:text-base">
                Seleziona la partita, scegli i marcatori dalle card e il risultato
                viene calcolato automaticamente.
              </p>
            </div>

            <a
              href="/manager"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center text-sm font-black uppercase tracking-wider text-white transition hover:border-lime-400 hover:text-lime-400"
            >
              Torna manager
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        {message && (
          <div className="mb-6 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 text-sm font-bold text-zinc-200">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 text-zinc-400">
            Caricamento partite...
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 text-zinc-400">
            Nessuna partita attiva da disputare.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <aside className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 md:p-6">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-400">
                Partite attive
              </p>

              <div className="mt-5 space-y-3">
                {matches.map((match) => {
                  const selected = String(match.id) === String(selectedMatchId);

                  return (
                    <button
                      key={`${match.source_table}-${match.id}`}
                      type="button"
                      onClick={() => {
                        setSelectedMatchId(String(match.id));
                        setHomeGoals({});
                        setAwayGoals({});
                      }}
                      className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                        selected
                          ? "border-lime-400 bg-lime-400/10"
                          : "border-white/10 bg-black/30 hover:border-lime-400/40"
                      }`}
                    >
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                        {match.competition_name} • {match.round || "Turno"}
                      </p>
                      <p className="mt-2 text-lg font-black text-white">
                        {match.home_club} vs {match.away_club}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {match.competition_type} {match.leg ? `• ${match.leg}` : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            </aside>

            {selectedMatch && (
              <div className="space-y-6">
                <div className="rounded-[2rem] border border-lime-400/20 bg-lime-400/10 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-400">
                    Risultato calcolato
                  </p>
                  <h2 className="mt-3 text-3xl font-black md:text-5xl">
                    {selectedMatch.home_club}{" "}
                    <span className="text-lime-400">{homeTotal}</span> -{" "}
                    <span className="text-lime-400">{awayTotal}</span>{" "}
                    {selectedMatch.away_club}
                  </h2>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 md:p-6">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-400">
                        Squadra casa
                      </p>
                      <h3 className="mt-2 text-2xl font-black md:text-4xl">
                        {selectedMatch.home_club}
                      </h3>
                    </div>
                    <div className="rounded-2xl bg-lime-400 px-5 py-3 text-2xl font-black text-black">
                      {homeTotal}
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {selectedMatch.home_players.map((player) => (
                      <PlayerCard
                        key={String(player.id)}
                        player={player}
                        club={selectedMatch.home_club}
                        selectedGoals={homeGoals[String(player.id)] || 0}
                        onChange={(goals) =>
                          setHomeGoals((current) => ({
                            ...current,
                            [String(player.id)]: goals,
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 md:p-6">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-400">
                        Squadra trasferta
                      </p>
                      <h3 className="mt-2 text-2xl font-black md:text-4xl">
                        {selectedMatch.away_club}
                      </h3>
                    </div>
                    <div className="rounded-2xl bg-lime-400 px-5 py-3 text-2xl font-black text-black">
                      {awayTotal}
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {selectedMatch.away_players.map((player) => (
                      <PlayerCard
                        key={String(player.id)}
                        player={player}
                        club={selectedMatch.away_club}
                        selectedGoals={awayGoals[String(player.id)] || 0}
                        onChange={(goals) =>
                          setAwayGoals((current) => ({
                            ...current,
                            [String(player.id)]: goals,
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>

                <div className="sticky bottom-4 rounded-[2rem] border border-white/10 bg-black/90 p-4 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={submitResult}
                    className="w-full rounded-2xl bg-lime-400 px-8 py-5 text-base font-black uppercase tracking-wider text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Invio risultato..." : "Invia risultato per conferma"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
