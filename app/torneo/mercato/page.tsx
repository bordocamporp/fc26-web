"use client";

import { useEffect, useMemo, useState } from "react";

type PlayerResult = {
  id: string | number;
  name: string;
  position?: string;
  team?: string;
  nation?: string;
  nationality?: string;
  league?: string;
  overall?: number;
  pace?: number;
  pac?: number;
  shooting?: number;
  sho?: number;
  passing?: number;
  pas?: number;
  dribbling?: number;
  dri?: number;
  defending?: number;
  def?: number;
  physical?: number;
  phy?: number;
  age?: number;
  weak_foot?: number;
  skill_moves?: number;
  market_value?: number;
  image_url?: string;
  owner_tag?: string | null;
  owner_club?: string | null;
  is_owned: boolean;
};

type TransferUpdate = {
  id: string | number;
  player_name: string;
  manager_name?: string;
  price?: number;
  source?: string;
  created_at?: string;
};

function statPercent(value: any) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function ovrColor(value: any) {
  const overall = Number(value || 0);
  if (overall >= 85) return "from-yellow-300 to-orange-400 text-black";
  if (overall >= 75) return "from-lime-300 to-lime-500 text-black";
  if (overall >= 65) return "from-emerald-400 to-green-600 text-black";
  return "from-zinc-500 to-zinc-700 text-white";
}

function StatBar({ label, value }: { label: string; value: any }) {
  const percent = statPercent(value);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-black text-zinc-500">{label}</span>
        <span className="font-black text-white">{value ?? "—"}</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-lime-400 shadow-[0_0_12px_rgba(132,204,22,0.7)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-zinc-300">
      {children}
    </span>
  );
}

function PlayerCard({ player }: { player: PlayerResult }) {
  const pace = player.pace ?? player.pac;
  const shooting = player.shooting ?? player.sho;
  const passing = player.passing ?? player.pas;
  const dribbling = player.dribbling ?? player.dri;
  const defending = player.defending ?? player.def;
  const physical = player.physical ?? player.phy;

  return (
    <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/55 p-5 transition duration-300 hover:-translate-y-1 hover:border-lime-400/60 hover:shadow-[0_0_45px_rgba(132,204,22,0.18)]">
      <div className="absolute right-[-55px] top-[-55px] h-40 w-40 rounded-full bg-lime-400/10 blur-[60px] transition group-hover:bg-lime-400/20" />

      <div className="relative z-10 flex items-start gap-4">
        <div className="flex h-24 w-24 shrink-0 items-end justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-800 to-black">
          {player.image_url ? (
            <img
              src={player.image_url}
              alt={player.name}
              className="h-24 object-contain transition duration-300 group-hover:scale-110"
            />
          ) : (
            <span className="mb-5 text-3xl">👤</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-xl font-black">{player.name}</h3>

              <p className="mt-1 text-sm text-zinc-400">
                {player.position || "N/D"} • {player.nation || player.nationality || "N/D"}
              </p>

              <p className="mt-1 truncate text-xs text-zinc-500">
                {player.team || "Club N/D"} {player.league ? `• ${player.league}` : ""}
              </p>
            </div>

            <div className={`rounded-2xl bg-gradient-to-br px-4 py-3 text-2xl font-black ${ovrColor(player.overall)}`}>
              {player.overall || "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
          Proprietario
        </p>

        {player.is_owned ? (
          <div className="mt-2">
            <p className="text-lg font-black text-lime-300">
              {player.owner_tag || "Manager registrato"}
            </p>
            {player.owner_club && (
              <p className="text-sm text-zinc-400">Club: {player.owner_club}</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-lg font-black text-emerald-300">
            Libero sul mercato
          </p>
        )}
      </div>

      <div className="relative z-10 mt-5 grid gap-3">
        <StatBar label="PAC" value={pace} />
        <StatBar label="SHO" value={shooting} />
        <StatBar label="PAS" value={passing} />
        <StatBar label="DRI" value={dribbling} />
        <StatBar label="DEF" value={defending} />
        <StatBar label="PHY" value={physical} />
      </div>

      <div className="relative z-10 mt-5 flex flex-wrap gap-2">
        {player.age && <Badge>{player.age} anni</Badge>}
        {player.weak_foot && <Badge>WF {player.weak_foot}</Badge>}
        {player.skill_moves && <Badge>SM {player.skill_moves}</Badge>}
        {player.market_value !== undefined && <Badge>Valore {player.market_value}</Badge>}
      </div>
    </article>
  );
}

function formatDate(value?: string) {
  if (!value) return "Aggiornamento";
  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Aggiornamento";
  }
}

export default function MercatoPage() {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<PlayerResult[]>([]);
  const [updates, setUpdates] = useState<TransferUpdate[]>([]);
  const [loading, setLoading] = useState(false);

  const cleanQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      setLoading(true);

      try {
        const params = new URLSearchParams();
        if (cleanQuery) params.set("q", cleanQuery);

        const response = await fetch(`/api/mercato/search?${params.toString()}`, {
          cache: "no-store",
        });

        const json = await response.json();

        if (!alive) return;

        setPlayers(json.players || []);
        setUpdates(json.updates || []);
      } catch (error) {
        if (!alive) return;
        setPlayers([]);
        setUpdates([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    const timer = setTimeout(loadData, cleanQuery ? 350 : 0);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [cleanQuery]);

  return (
    <main className="min-h-screen bg-[#020403] text-white">
      <section className="relative overflow-hidden border-b border-lime-400/20 px-5 py-10 md:px-8 md:py-16">
        <div className="absolute left-[-180px] top-[-180px] h-[440px] w-[440px] rounded-full bg-lime-400/20 blur-[140px]" />
        <div className="absolute bottom-[-200px] right-[-130px] h-[440px] w-[440px] rounded-full bg-emerald-500/10 blur-[140px]" />

        <div className="relative z-10 mx-auto max-w-7xl">
          <a
            href="/"
            className="mb-8 inline-flex rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-zinc-200 transition hover:border-lime-400 hover:bg-lime-400 hover:text-black"
          >
            ← TORNA ALLA HOME
          </a>

          <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
            Mercato Discord
          </p>

          <h1 className="mt-4 max-w-4xl text-5xl font-black leading-none md:text-7xl">
            Cerca giocatori e segui gli aggiornamenti
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-300">
            Le trattative si fanno solo sul bot Discord. Qui puoi consultare il database,
            vedere statistiche, club e tag Discord del manager che possiede il giocatore.
          </p>

          <div className="mt-8 max-w-3xl rounded-[2rem] border border-lime-400/25 bg-black/65 p-4 shadow-[0_0_50px_rgba(132,204,22,0.12)] backdrop-blur-xl">
            <label className="text-xs font-black uppercase tracking-[0.25em] text-lime-400">
              Filtro mercato
            </label>

            <div className="mt-3 flex flex-col gap-3 md:flex-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca giocatore, club, ruolo, nazione..."
                className="min-h-[58px] flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-5 text-base font-bold text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-400"
              />

              <a
                href="https://discord.gg/WJXXcGr2J3"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[58px] items-center justify-center rounded-2xl bg-lime-400 px-6 text-center font-black text-black shadow-[0_0_30px_rgba(132,204,22,0.30)] transition hover:scale-105 hover:bg-lime-300"
              >
                APRI DISCORD
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:px-8 xl:grid-cols-[1fr_390px]">
        <div>
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-lime-400">
                Database giocatori
              </p>

              <h2 className="mt-2 text-3xl font-black">
                {cleanQuery ? `Risultati per “${cleanQuery}”` : "Cerca un player"}
              </h2>
            </div>

            {loading && <p className="text-sm font-bold text-zinc-500">Caricamento...</p>}
          </div>

          {!cleanQuery && (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-zinc-300">
              Scrivi il nome di un giocatore per vedere la card completa con statistiche,
              club e proprietario. Non mostriamo ID Discord, solo il tag/nome manager.
            </div>
          )}

          {cleanQuery && players.length === 0 && !loading && (
            <div className="rounded-[2rem] border border-orange-400/20 bg-orange-400/10 p-8 text-orange-100">
              Nessun giocatore trovato nel database.
            </div>
          )}

          {players.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {players.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-lime-400">
              Aggiornamenti mercato
            </p>

            <h2 className="mt-3 text-3xl font-black">Ultime operazioni</h2>

            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Storico aggiornato dal bot Discord quando vengono registrate aste, trasferimenti o operazioni.
            </p>

            <div className="mt-6 space-y-3">
              {updates.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-zinc-500">
                  Nessun aggiornamento mercato disponibile.
                </div>
              ) : (
                updates.map((update) => (
                  <div
                    key={update.id}
                    className="rounded-2xl border border-white/10 bg-black/45 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="rounded-full bg-lime-400 px-3 py-1 font-black text-black">
                        {update.source || "MERCATO"}
                      </span>
                      <span className="text-zinc-500">{formatDate(update.created_at)}</span>
                    </div>

                    <p className="text-lg font-black text-white">
                      {update.player_name}
                    </p>

                    {update.manager_name && (
                      <p className="mt-1 text-sm text-zinc-400">
                        Manager: {update.manager_name}
                      </p>
                    )}

                    {update.price !== undefined && (
                      <p className="mt-2 text-sm font-black text-lime-300">
                        Prezzo: {update.price} crediti
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-red-400/25 bg-red-500/10 p-6">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-red-300">
              Regola mercato
            </p>

            <h3 className="mt-3 text-2xl font-black">
              Le trattative si fanno sul bot Discord
            </h3>

            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Questa pagina serve solo per cercare giocatori e vedere aggiornamenti.
              Offerte, aste e scambi devono passare dal server Discord.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
