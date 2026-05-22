"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Player = {
  id: string | number;
  name: string;
  position?: string | null;
  overall?: number | string | null;
  team?: string | null;
  image_url?: string | null;
  card_url?: string | null;
  photo_url?: string | null;
  avatar_url?: string | null;
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

function matchKey(match: Match) {
  return `${match.source_table}-${match.id}`;
}

function getPlayerImage(player: Player) {
  return player.card_url || player.image_url || player.photo_url || player.avatar_url || "";
}

function PlayerMiniCard({
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
  const image = getPlayerImage(player);

  return (
    <div
      className={`grid grid-cols-[50px_1fr_auto] items-center gap-2.5 rounded-2xl border p-2 transition ${
        selectedGoals > 0
          ? "border-lime-400 bg-lime-400/10 shadow-[0_0_20px_rgba(132,204,22,0.16)]"
          : "border-white/10 bg-white/[0.035] hover:border-lime-400/40"
      }`}
    >
      <div className="relative h-[58px] w-[50px] overflow-hidden rounded-xl bg-zinc-900">
        {image ? (
          <Image
            src={image}
            alt={player.name}
            fill
            className="object-cover"
            sizes="50px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-white/10 text-xs font-black text-lime-400">
            {player.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-xs font-black text-white md:text-sm">{player.name}</p>
        <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          {player.position || "Player"} {player.overall ? `• OVR ${player.overall}` : ""}
        </p>
        <p className="mt-0.5 truncate text-[9px] text-zinc-500">{club}</p>
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/35 p-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, selectedGoals - 1))}
          className="h-7 w-7 rounded-lg bg-white/10 text-sm font-black text-white transition hover:bg-red-400 hover:text-black"
        >
          -
        </button>

        <div className="w-7 text-center">
          <p className="text-[7px] font-black uppercase tracking-[0.18em] text-zinc-500">Gol</p>
          <p className="text-base font-black leading-none text-lime-400">{selectedGoals}</p>
        </div>

        <button
          type="button"
          onClick={() => onChange(Math.min(12, selectedGoals + 1))}
          className="h-7 w-7 rounded-lg bg-lime-400 text-sm font-black text-black transition hover:scale-105"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function TorneoRisultatiPage() {
  const [sessionUserId, setSessionUserId] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchKey, setSelectedMatchKey] = useState("");
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

      const loadedMatches = data.matches || [];
      setMatches(loadedMatches);

      if (loadedMatches.length && !selectedMatchKey) {
        setSelectedMatchKey(matchKey(loadedMatches[0]));
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
    () => matches.find((match) => matchKey(match) === selectedMatchKey),
    [matches, selectedMatchKey]
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

    // 0-0 è valido: nessun controllo obbligatorio sui marcatori.

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

      setMessage("✅ Risultato inviato. La partita sparirà dall’elenco e l’avversario riceverà la conferma in privato su Discord.");
      setHomeGoals({});
      setAwayGoals({});
      setSelectedMatchKey("");
      await load();
    } catch (error: any) {
      setMessage(`❌ ${error.message || "Errore invio risultato."}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-lime-400/20 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.18),transparent_35%),linear-gradient(180deg,#050505,#000)] px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                Area Manager
              </p>
              <h1 className="mt-2 text-4xl font-black uppercase leading-none md:text-6xl">
                Inserisci risultato
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-zinc-400">
                Seleziona la partita, scegli i marcatori dalle card e il risultato viene calcolato automaticamente. Anche 0-0 è valido.
              </p>
            </div>

            <a
              href="/manager"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-xs font-black uppercase tracking-wider text-white transition hover:border-lime-400 hover:text-lime-400"
            >
              Torna manager
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-4 py-6 md:px-8">
        {message && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-bold text-zinc-200">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6 text-zinc-400">
            Caricamento partite...
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6 text-zinc-400">
            Nessuna partita attiva da disputare.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[410px_1fr] xl:grid-cols-[460px_1fr]">
            <aside className="max-h-[calc(100vh-190px)] overflow-y-auto rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-400">
                Partite attive
              </p>

              <div className="mt-4 space-y-2.5">
                {matches.map((match) => {
                  const currentKey = matchKey(match);
                  const selected = currentKey === selectedMatchKey;

                  return (
                    <button
                      key={currentKey}
                      type="button"
                      onClick={() => {
                        setSelectedMatchKey(currentKey);
                        setHomeGoals({});
                        setAwayGoals({});
                      }}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        selected
                          ? "border-lime-400 bg-lime-400/10"
                          : "border-white/10 bg-black/30 hover:border-lime-400/40"
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                        {match.competition_name} • {match.round || "Turno"}
                      </p>
                      <p className="mt-1.5 truncate text-base font-black text-white">
                        {match.home_club} vs {match.away_club}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {match.competition_type} {match.leg ? `• ${match.leg}` : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            </aside>

            {selectedMatch && (
              <div className="space-y-5">
                <div className="rounded-[1.7rem] border border-lime-400/20 bg-lime-400/10 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-400">
                    Risultato calcolato
                  </p>
                  <h2 className="mt-2 text-3xl font-black md:text-5xl">
                    {selectedMatch.home_club}{" "}
                    <span className="text-lime-400">{homeTotal}</span> -{" "}
                    <span className="text-lime-400">{awayTotal}</span>{" "}
                    {selectedMatch.away_club}
                  </h2>
                </div>

                <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-400">
                        Squadra casa
                      </p>
                      <h3 className="mt-1 truncate text-2xl font-black md:text-3xl">
                        {selectedMatch.home_club}
                      </h3>
                    </div>
                    <div className="rounded-2xl bg-lime-400 px-4 py-2 text-2xl font-black text-black">
                      {homeTotal}
                    </div>
                  </div>

                  <div className="mt-4 max-h-[430px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
                      {selectedMatch.home_players.map((player) => (
                        <PlayerMiniCard
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
                </div>

                <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-400">
                        Squadra trasferta
                      </p>
                      <h3 className="mt-1 truncate text-2xl font-black md:text-3xl">
                        {selectedMatch.away_club}
                      </h3>
                    </div>
                    <div className="rounded-2xl bg-lime-400 px-4 py-2 text-2xl font-black text-black">
                      {awayTotal}
                    </div>
                  </div>

                  <div className="mt-4 max-h-[430px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
                      {selectedMatch.away_players.map((player) => (
                        <PlayerMiniCard
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
                </div>

                <div className="sticky bottom-4 rounded-[1.7rem] border border-white/10 bg-black/90 p-3 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={submitResult}
                    className="w-full rounded-2xl bg-lime-400 px-8 py-4 text-sm font-black uppercase tracking-wider text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
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
