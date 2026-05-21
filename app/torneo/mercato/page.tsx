"use client";

import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import AnalyticsTracker from "../../components/AnalyticsTracker";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Transfer = any;
type Manager = any;
type Player = any;
type Auction = any;

function n(value: any) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: any) {
  return `${n(value)} cr`;
}

function formatDate(value: any) {
  if (!value) return "N/D";

  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "N/D";
  }
}

function ovrColor(overall: any) {
  const value = n(overall);

  if (value >= 85) return "from-yellow-300 to-orange-400 text-black";
  if (value >= 75) return "from-lime-300 to-lime-500 text-black";
  if (value >= 65) return "from-emerald-400 to-green-600 text-black";
  return "from-zinc-500 to-zinc-700 text-white";
}

function operationLabel(source: any) {
  const value = String(source || "mercato").toLowerCase();

  if (value.includes("auction") || value.includes("asta")) return "ASTA";
  if (value.includes("trade") || value.includes("scambio")) return "SCAMBIO";
  if (value.includes("sell") || value.includes("vendita")) return "VENDITA";
  if (value.includes("release") || value.includes("svincolo")) return "SVINCOLO";
  if (value.includes("real")) return "ROSA REALE";

  return "MERCATO";
}

function operationClass(source: any) {
  const label = operationLabel(source);

  if (label === "ASTA") return "border-lime-400/30 bg-lime-400/10 text-lime-300";
  if (label === "SCAMBIO") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
  if (label === "VENDITA") return "border-orange-400/30 bg-orange-400/10 text-orange-300";
  if (label === "SVINCOLO") return "border-red-400/30 bg-red-400/10 text-red-300";

  return "border-white/10 bg-white/[0.06] text-zinc-300";
}

async function loadMarketData() {
  const { data: transfers } = await supabase
    .from("transfer_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(150);

  const { data: managers } = await supabase
    .from("managers")
    .select("*")
    .order("budget", { ascending: false });

  const { data: soldPlayers } = await supabase
    .from("players")
    .select("*")
    .not("owner_discord_id", "is", null)
    .order("sold_price", { ascending: false })
    .limit(100);

  const { data: freePlayers } = await supabase
    .from("players")
    .select("*")
    .is("owner_discord_id", null)
    .order("overall", { ascending: false })
    .limit(24);

  const { data: auctions } = await supabase
    .from("auctions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    transfers: transfers || [],
    managers: managers || [],
    soldPlayers: soldPlayers || [],
    freePlayers: freePlayers || [],
    auctions: auctions || [],
  };
}

export default function MercatoPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [soldPlayers, setSoldPlayers] = useState<Player[]>([]);
  const [freePlayers, setFreePlayers] = useState<Player[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("all");
  const [operationFilter, setOperationFilter] = useState("all");

  async function refresh() {
    const data = await loadMarketData();

    setTransfers(data.transfers);
    setManagers(data.managers);
    setSoldPlayers(data.soldPlayers);
    setFreePlayers(data.freePlayers);
    setAuctions(data.auctions);
    setLastUpdate(new Date());
    setLoading(false);
  }

  useEffect(() => {
    refresh();

    const timer = setInterval(() => {
      refresh();
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  const managerMap = useMemo(() => {
    return new Map(managers.map((m: any) => [String(m.discord_id), m]));
  }, [managers]);

  const enrichedTransfers = useMemo(() => {
    return transfers.map((transfer: any) => {
      const manager =
        managerMap.get(String(transfer.manager_id)) ||
        managers.find((m: any) => String(m.manager_name) === String(transfer.manager_name)) ||
        null;

      const player =
        soldPlayers.find((p: any) => String(p.id) === String(transfer.player_id)) ||
        soldPlayers.find((p: any) => String(p.name) === String(transfer.player_name)) ||
        null;

      return {
        ...transfer,
        manager,
        player,
      };
    });
  }, [transfers, managerMap, managers, soldPlayers]);

  const filteredTransfers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return enrichedTransfers.filter((transfer: any) => {
      const playerName = String(transfer.player_name || transfer.player?.name || "").toLowerCase();
      const managerName = String(
        transfer.manager_name ||
          transfer.manager?.manager_name ||
          transfer.manager?.club_name ||
          transfer.manager_id ||
          ""
      ).toLowerCase();
      const clubName = String(transfer.manager?.club_name || "").toLowerCase();

      const matchesSearch =
        !q ||
        playerName.includes(q) ||
        managerName.includes(q) ||
        clubName.includes(q);

      const matchesManager =
        managerFilter === "all" ||
        String(transfer.manager_id) === managerFilter ||
        String(transfer.manager?.discord_id) === managerFilter;

      const matchesOperation =
        operationFilter === "all" ||
        operationLabel(transfer.source).toLowerCase() === operationFilter;

      return matchesSearch && matchesManager && matchesOperation;
    });
  }, [enrichedTransfers, search, managerFilter, operationFilter]);

  const topTransfers = useMemo(() => {
    return [...enrichedTransfers]
      .sort((a: any, b: any) => n(b.price) - n(a.price))
      .slice(0, 8);
  }, [enrichedTransfers]);

  const managerBudgets = useMemo(() => {
    return managers.map((manager: any) => {
      const managerTransfers = transfers.filter(
        (t: any) => String(t.manager_id) === String(manager.discord_id)
      );

      const spentFromHistory = managerTransfers.reduce(
        (sum: number, t: any) => sum + n(t.price),
        0
      );

      const ownedPlayers = soldPlayers.filter(
        (p: any) => String(p.owner_discord_id) === String(manager.discord_id)
      );

      const spentFromPlayers = ownedPlayers.reduce(
        (sum: number, p: any) => sum + n(p.sold_price),
        0
      );

      const spent = Math.max(spentFromHistory, spentFromPlayers);
      const remaining = n(manager.budget);
      const initialBudget = spent + remaining;

      return {
        ...manager,
        spent,
        remaining,
        initialBudget,
        ownedPlayers: ownedPlayers.length,
      };
    });
  }, [managers, transfers, soldPlayers]);

  const totalTransfers = transfers.length;
  const totalVolume = transfers.reduce((sum: number, t: any) => sum + n(t.price), 0);
  const avgPrice = totalTransfers > 0 ? Math.round(totalVolume / totalTransfers) : 0;
  const openAuctions = auctions.filter((a: any) => a.status === "open").length;

  return (
    <main className="min-h-screen overflow-hidden bg-[#020403] text-white">
      <AnalyticsTracker page="torneo-mercato" />

      <div className="fixed left-[-180px] top-[-180px] h-[500px] w-[500px] rounded-full bg-lime-400/20 blur-[160px]" />
      <div className="fixed bottom-[-200px] right-[-160px] h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-[170px]" />

      <header className="relative z-20 border-b border-lime-400/20 bg-black/80 px-4 md:px-6 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-4 md:flex-row md:items-center md:justify-between gap-4 md:p-6">
          <a href="/torneo" className="flex items-center gap-4">
            <Image
              src="/logo-bordo-campo.png"
              alt="Bordo Campo"
              width={58}
              height={58}
              priority
            />

            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] md:tracking-[0.45em] text-lime-400">
                Torneo BC FC
              </p>
              <h1 className="text-base md:text-xl md:text-3xl font-black uppercase tracking-widest">
                Mercato Live
              </h1>
            </div>
          </a>

          <nav className="hidden items-center gap-3 lg:flex">
            <TopNav href="/torneo" label="Dashboard" />
            <TopNav href="/torneo/classifiche" label="Classifiche" />
            <TopNav href="/torneo/calendario" label="Calendario" />
            <TopNav href="/torneo/risultati" label="Risultati" />
            <TopNav href="/torneo/mercato" label="Mercato" active />
            <TopNav href="/manager" label="Area Manager" />
          </nav>
        </div>
      </header>

      <section className="relative z-10 border-b border-lime-400/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(132,204,22,0.24),transparent_35%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-lime-400/10 via-black/40 to-black" />

        <div className="relative z-10 mx-auto grid max-w-[1700px] items-center gap-4 md:p-6 md:p-10 px-4 md:px-6 py-8 md:py-10 md:py-16 xl:grid-cols-[1fr_430px]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] md:tracking-[0.45em] text-lime-400">
              Discord Market Sync
            </p>

            <h2 className="mt-5 text-2xl md:text-4xl md:text-6xl font-black leading-none md:text-base md:text-xl md:text-3xl md:text-5xl md:text-8xl">
              MERCATO
              <br />
              BC FC
            </h2>

            <p className="mt-6 max-w-3xl text-base md:text-lg leading-relaxed text-zinc-300">
              Il mercato si svolge su Discord. Il sito mostra in tempo reale
              trasferimenti, budget aggiornati, rose modificate e storico operazioni.
            </p>

            <div className="mt-10 grid max-w-5xl gap-4 md:grid-cols-4">
              <HeroMetric title="Trasferimenti" value={totalTransfers} tone="lime" />
              <HeroMetric title="Volume mercato" value={money(totalVolume)} tone="cyan" />
              <HeroMetric title="Prezzo medio" value={money(avgPrice)} tone="orange" />
              <HeroMetric title="Aste aperte" value={openAuctions} tone="white" />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="/manager"
                className="rounded-2xl bg-lime-400 px-5 py-4 md:px-4 md:px-8 font-black text-black shadow-[0_0_35px_rgba(132,204,22,0.35)] transition hover:scale-105"
              >
                AREA MANAGER
              </a>

              <button
                onClick={refresh}
                className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 md:px-4 md:px-8 font-black backdrop-blur transition hover:border-lime-400 hover:text-lime-300"
              >
                AGGIORNA ORA
              </button>

              <p className="text-sm text-zinc-500">
                Auto-refresh ogni 15s
                {lastUpdate && <> • ultimo update {lastUpdate.toLocaleTimeString("it-IT")}</>}
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] md:rounded-[2rem] md:rounded-[2.5rem] border border-lime-400/25 bg-black/55 p-5 md:p-7 shadow-[0_0_80px_rgba(132,204,22,0.12)] backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.35em] text-lime-400">
              Top trasferimento
            </p>

            {topTransfers[0] ? (
              <TopTransfer transfer={topTransfers[0]} />
            ) : (
              <p className="mt-6 text-zinc-400">
                Nessun trasferimento ancora registrato.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-[1700px] gap-5 md:p-8 px-4 md:px-6 py-8 md:py-10 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-6">
          <Panel title="Navigazione">
            <div className="grid gap-3">
              <SideLink href="/torneo" label="Dashboard torneo" />
              <SideLink href="/torneo/mercato" label="Mercato" active />
              <SideLink href="/torneo/classifiche" label="Classifiche" />
              <SideLink href="/torneo/calendario" label="Calendario" />
              <SideLink href="/torneo/risultati" label="Risultati" />
              <SideLink href="/manager" label="Area Manager" />
            </div>
          </Panel>

          <Panel title="Filtri mercato">
            <div className="grid gap-4">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">
                  Cerca
                </label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Giocatore, club, manager..."
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-lime-400"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">
                  Manager / Club
                </label>
                <select
                  value={managerFilter}
                  onChange={(e) => setManagerFilter(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none transition focus:border-lime-400"
                >
                  <option value="all">Tutti</option>
                  {managers.map((manager: any) => (
                    <option key={manager.discord_id} value={manager.discord_id}>
                      {manager.club_name || manager.manager_name || manager.name || manager.discord_id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">
                  Operazione
                </label>
                <select
                  value={operationFilter}
                  onChange={(e) => setOperationFilter(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none transition focus:border-lime-400"
                >
                  <option value="all">Tutte</option>
                  <option value="asta">Asta</option>
                  <option value="scambio">Scambio</option>
                  <option value="vendita">Vendita</option>
                  <option value="svincolo">Svincolo</option>
                  <option value="mercato">Mercato</option>
                </select>
              </div>
            </div>
          </Panel>

          <Panel title="Budget manager">
            <div className="space-y-3">
              {managerBudgets.length ? (
                managerBudgets.slice(0, 12).map((manager: any) => (
                  <BudgetCard key={manager.discord_id} manager={manager} />
                ))
              ) : (
                <EmptyState text="Nessun manager registrato." />
              )}
            </div>
          </Panel>
        </aside>

        <div className="grid gap-5 md:p-8">
          <section className="grid gap-4 md:p-6 md:grid-cols-3">
            <MarketCard
              title="Giocatori assegnati"
              value={soldPlayers.length}
              description="Calciatori attualmente collegati a un manager."
              type="players"
            />

            <MarketCard
              title="Manager attivi"
              value={managers.length}
              description="Manager presenti nel database torneo."
              type="managers"
            />

            <MarketCard
              title="Aste recenti"
              value={auctions.length}
              description="Ultime aste registrate dal bot Discord."
              type="auctions"
            />
          </section>

          <section className="rounded-[1.5rem] md:rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-7 backdrop-blur-xl">
            <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.35em] text-lime-400">
                  Top trasferimenti
                </p>
                <h3 className="mt-2 text-2xl md:text-4xl font-black">
                  Colpi più costosi
                </h3>
              </div>

              <p className="text-sm text-zinc-400">
                Ordinati per prezzo
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {topTransfers.length ? (
                topTransfers.map((transfer: any) => (
                  <TopTransferMini key={transfer.id} transfer={transfer} />
                ))
              ) : (
                <EmptyState text="Nessun trasferimento registrato." />
              )}
            </div>
          </section>

          <section className="grid gap-5 md:p-8 xl:grid-cols-[1fr_430px]">
            <div className="rounded-[1.5rem] md:rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-7 backdrop-blur-xl">
              <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.35em] text-lime-400">
                    Storico mercato
                  </p>
                  <h3 className="mt-2 text-2xl md:text-4xl font-black">
                    Trasferimenti live
                  </h3>
                </div>

                <p className="text-sm text-zinc-400">
                  {filteredTransfers.length} operazioni visualizzate
                </p>
              </div>

              <div className="grid gap-4">
                {loading ? (
                  <EmptyState text="Caricamento mercato..." />
                ) : filteredTransfers.length ? (
                  filteredTransfers.map((transfer: any) => (
                    <TransferRow key={transfer.id} transfer={transfer} />
                  ))
                ) : (
                  <EmptyState text="Nessun trasferimento trovato con questi filtri." />
                )}
              </div>
            </div>

            <Panel title="Top acquisti rosa">
              <div className="space-y-3">
                {soldPlayers.length ? (
                  soldPlayers.slice(0, 8).map((player: any) => {
                    const manager = managerMap.get(String(player.owner_discord_id));

                    return (
                      <PlayerMiniCard
                        key={player.id}
                        player={player}
                        subtitle={manager?.club_name || manager?.manager_name || player.owner_discord_id}
                        value={money(player.sold_price)}
                      />
                    );
                  })
                ) : (
                  <EmptyState text="Nessun acquisto registrato." />
                )}
              </div>
            </Panel>
          </section>

          <section className="grid gap-5 md:p-8 xl:grid-cols-[1fr_430px]">
            <div className="rounded-[1.5rem] md:rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-7 backdrop-blur-xl">
              <div className="mb-7">
                <p className="text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.35em] text-lime-400">
                  Giocatori liberi
                </p>
                <h3 className="mt-2 text-2xl md:text-4xl font-black">
                  Migliori ancora disponibili
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {freePlayers.length ? (
                  freePlayers.map((player: any) => (
                    <FreePlayerCard key={player.id} player={player} />
                  ))
                ) : (
                  <EmptyState text="Nessun giocatore libero trovato." />
                )}
              </div>
            </div>

            <Panel title="Aste Discord">
              <div className="space-y-3">
                {auctions.length ? (
                  auctions.map((auction: any) => (
                    <AuctionCard key={auction.id} auction={auction} />
                  ))
                ) : (
                  <EmptyState text="Nessuna asta trovata." />
                )}
              </div>
            </Panel>
          </section>
        </div>
      </section>
    </main>
  );
}

function TopTransfer({ transfer }: { transfer: any }) {
  return (
    <div className="mt-6 rounded-[1.5rem] md:rounded-[2rem] border border-lime-400/25 bg-lime-400/10 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xl md:text-4xl font-black">
            {transfer.player_name || transfer.player?.name || "Giocatore"}
          </p>

          <p className="mt-3 text-zinc-300">
            acquistato da{" "}
            <b className="text-lime-300">
              {transfer.manager?.club_name ||
                transfer.manager_name ||
                transfer.manager_id ||
                "Manager"}
            </b>
          </p>
        </div>

        <Badge className={operationClass(transfer.source)}>
          {operationLabel(transfer.source)}
        </Badge>
      </div>

      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-2xl border border-white/10 bg-black/40 p-4">
        <span className="text-sm text-zinc-400">Prezzo</span>
        <span className="text-base md:text-xl md:text-3xl font-black text-lime-400">
          {money(transfer.price)}
        </span>
      </div>

      <p className="mt-4 text-sm text-zinc-500">
        {formatDate(transfer.created_at)}
      </p>
    </div>
  );
}

function TopTransferMini({ transfer }: { transfer: any }) {
  return (
    <div className="rounded-[1.7rem] border border-lime-400/20 bg-black/35 p-5 transition hover:-translate-y-1 hover:border-lime-400/60">
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between gap-3">
        <Badge className={operationClass(transfer.source)}>
          {operationLabel(transfer.source)}
        </Badge>

        <span className="text-base md:text-xl font-black text-lime-400">
          {money(transfer.price)}
        </span>
      </div>

      <p className="truncate text-base md:text-xl font-black">
        {transfer.player_name || "Giocatore"}
      </p>

      <p className="mt-2 truncate text-sm text-zinc-400">
        {transfer.manager?.club_name ||
          transfer.manager_name ||
          transfer.manager_id ||
          "Manager"}
      </p>

      <p className="mt-3 text-xs text-zinc-500">
        {formatDate(transfer.created_at)}
      </p>
    </div>
  );
}

function BudgetCard({ manager }: { manager: any }) {
  const spent = n(manager.spent);
  const remaining = n(manager.remaining);
  const initial = Math.max(n(manager.initialBudget), spent + remaining, 1);
  const spentPct = Math.min(100, Math.round((spent / initial) * 100));

  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black">
            {manager.club_name || manager.manager_name || manager.name || "Manager"}
          </p>
          <p className="mt-1 truncate text-xs text-zinc-500">
            {manager.ownedPlayers} giocatori
          </p>
        </div>

        <span className="rounded-xl bg-lime-400 px-3 py-2 text-sm font-black text-black">
          {money(remaining)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
          <p className="text-zinc-500">Speso</p>
          <p className="mt-1 font-black text-orange-300">{money(spent)}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
          <p className="text-zinc-500">Budget iniziale</p>
          <p className="mt-1 font-black text-white">{money(initial)}</p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-lime-400 shadow-[0_0_12px_rgba(132,204,22,0.7)]"
          style={{ width: `${spentPct}%` }}
        />
      </div>
    </div>
  );
}

function TopNav({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
        active
          ? "bg-lime-400 text-black shadow-[0_0_25px_rgba(132,204,22,0.30)]"
          : "text-white/80 hover:bg-white/10 hover:text-lime-300"
      }`}
    >
      {label}
    </a>
  );
}

function HeroMetric({
  title,
  value,
  tone,
}: {
  title: string;
  value: number | string;
  tone: "lime" | "cyan" | "orange" | "white";
}) {
  const colors = {
    lime: "text-lime-400",
    cyan: "text-cyan-400",
    orange: "text-orange-400",
    white: "text-white",
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-5 backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
        {title}
      </p>

      <p className={`mt-3 text-base md:text-xl md:text-3xl font-black ${colors[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function SideLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className={`block rounded-2xl px-5 py-4 font-bold transition ${
        active
          ? "bg-lime-400 text-black shadow-[0_0_25px_rgba(132,204,22,0.22)]"
          : "bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-lime-300"
      }`}
    >
      {label}
    </a>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] md:rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 md:p-6 backdrop-blur-xl">
      <p className="text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.35em] text-lime-400">
        {title}
      </p>

      <div className="mt-6">
        {children}
      </div>
    </div>
  );
}

function MarketCard({
  title,
  value,
  description,
  type,
}: {
  title: string;
  value: number;
  description: string;
  type: "players" | "managers" | "auctions";
}) {
  return (
    <div className="group relative overflow-hidden rounded-[1.5rem] md:rounded-[2rem] border border-lime-400/25 bg-gradient-to-br from-lime-400/10 via-white/[0.03] to-black p-5 md:p-7 transition duration-300 hover:-translate-y-1 hover:border-lime-300 hover:shadow-[0_0_40px_rgba(132,204,22,0.18)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(132,204,22,0.20),transparent_45%)] opacity-80" />
      <div className="relative z-10 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/35 bg-black/55">
        <MarketIcon type={type} />
      </div>

      <p className="relative z-10 text-sm font-black uppercase tracking-[0.25em] text-zinc-500">
        {title}
      </p>

      <p className="relative z-10 mt-3 text-2xl md:text-4xl md:text-6xl font-black text-white">
        {value}
      </p>

      <p className="relative z-10 mt-3 text-sm leading-relaxed text-zinc-400">
        {description}
      </p>
    </div>
  );
}

function TransferRow({ transfer }: { transfer: any }) {
  return (
    <div className="group rounded-[1.5rem] border border-white/10 bg-black/30 p-5 transition hover:border-lime-400/50 hover:bg-lime-400/5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge className={operationClass(transfer.source)}>
              {operationLabel(transfer.source)}
            </Badge>

            {transfer.player?.overall && (
              <Badge>{transfer.player.overall} OVR</Badge>
            )}
          </div>

          <h4 className="text-2xl font-black">
            {transfer.player_name || transfer.player?.name || "Giocatore"}
          </h4>

          <p className="mt-1 text-sm text-zinc-400">
            Manager:{" "}
            {transfer.manager?.club_name ||
              transfer.manager_name ||
              transfer.manager_id ||
              "N/D"}
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            {formatDate(transfer.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-2xl border border-lime-400/30 bg-lime-400/10 px-5 py-3 font-black text-lime-300">
            {money(transfer.price)}
          </span>
        </div>
      </div>
    </div>
  );
}

function PlayerMiniCard({
  player,
  subtitle,
  value,
}: {
  player: any;
  subtitle: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-end justify-center overflow-hidden rounded-2xl border border-lime-400/20 bg-gradient-to-b from-lime-400/20 to-black">
          {player.image_url ? (
            <img
              src={player.image_url}
              alt={player.name}
              className="h-16 object-contain"
            />
          ) : (
            <span className="mb-3 text-2xl">👤</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="truncate font-black">
                {player.name}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {player.position || "N/D"} • {player.team || "N/D"}
              </p>
            </div>

            <span className={`rounded-xl bg-gradient-to-br px-3 py-2 text-base md:text-lg font-black ${ovrColor(player.overall)}`}>
              {player.overall || "—"}
            </span>
          </div>

          <p className="mt-3 text-sm text-zinc-400">{subtitle}</p>
          <p className="mt-1 text-sm font-black text-lime-400">{value}</p>
        </div>
      </div>
    </div>
  );
}

function FreePlayerCard({ player }: { player: any }) {
  return (
    <article className="rounded-[1.7rem] border border-white/10 bg-black/35 p-5 transition hover:border-lime-400/50 hover:bg-lime-400/5">
      <div className="flex items-start gap-4">
        <div className="flex h-20 w-20 shrink-0 items-end justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-800 to-black">
          {player.image_url ? (
            <img
              src={player.image_url}
              alt={player.name}
              className="h-20 object-contain"
            />
          ) : (
            <span className="mb-4 text-base md:text-xl md:text-3xl">👤</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="truncate text-base md:text-xl font-black">{player.name}</h4>
              <p className="mt-1 text-sm text-zinc-400">
                {player.position || "N/D"} • {player.team || "N/D"}
              </p>
            </div>

            <div className={`rounded-2xl bg-gradient-to-br px-4 py-3 text-2xl font-black ${ovrColor(player.overall)}`}>
              {player.overall || "—"}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function AuctionCard({ auction }: { auction: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="font-black">
            Asta #{auction.id}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Player ID: {auction.player_id}
          </p>
        </div>

        <span className={`rounded-full px-3 py-1 text-xs font-black ${
          auction.status === "open"
            ? "bg-lime-400 text-black"
            : "bg-white/10 text-zinc-300"
        }`}>
          {auction.status || "N/D"}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-lime-400/20 bg-lime-400/10 p-3">
        <p className="text-xs text-lime-300">Offerta attuale</p>
        <p className="mt-1 text-2xl font-black">
          {money(auction.highest_bid)}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 md:p-6 text-zinc-400">
      {text}
    </div>
  );
}

function Badge({
  children,
  className = "border-white/10 bg-white/[0.06] text-white/70",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`rounded-full border px-4 py-2 text-xs font-black ${className}`}>
      {children}
    </span>
  );
}

function MarketIcon({
  type,
}: {
  type: "players" | "managers" | "auctions";
}) {
  if (type === "players") {
    return (
      <svg viewBox="0 0 96 96" className="h-11 w-11 text-lime-400" fill="none">
        <circle cx="48" cy="30" r="15" fill="currentColor" opacity="0.18" />
        <circle cx="48" cy="30" r="15" stroke="currentColor" strokeWidth="5" />
        <path d="M22 78c4-18 16-28 26-28s22 10 26 28" fill="currentColor" opacity="0.12" />
        <path d="M22 78c4-18 16-28 26-28s22 10 26 28" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "managers") {
    return (
      <svg viewBox="0 0 96 96" className="h-11 w-11 text-lime-400" fill="none">
        <path d="M20 72c4-16 15-24 28-24s24 8 28 24" fill="currentColor" opacity="0.12" />
        <circle cx="48" cy="30" r="14" stroke="currentColor" strokeWidth="5" />
        <path d="M20 72c4-16 15-24 28-24s24 8 28 24" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M68 22l8-8M76 14l6 6" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 96 96" className="h-11 w-11 text-lime-400" fill="none">
      <path d="M24 34h48l-5 40H29L24 34Z" fill="currentColor" opacity="0.16" />
      <path d="M24 34h48l-5 40H29L24 34Z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <path d="M36 34c0-9 4-16 12-16s12 7 12 16" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M38 52h20M38 63h14" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
