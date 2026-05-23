import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import AnalyticsTracker from "../components/AnalyticsTracker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);


async function fetchAllPlayersForRosters() {
  const pageSize = 1000;
  let from = 0;
  let allPlayers: any[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("players")
      .select("id, name, team, position, overall, owner_discord_id, sold_price")
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Errore caricamento players:", error.message);
      break;
    }

    const batch = data || [];
    allPlayers = [...allPlayers, ...batch];

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return allPlayers;
}


function n(value: any) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(value: number, max = 100) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function statusLabel(status?: string | null) {
  const value = String(status || "").toLowerCase();

  if (value === "accepted") return "Accettato";
  if (value === "pending") return "In attesa";
  if (value === "rejected") return "Rifiutato";
  if (value === "reset") return "Reset";
  return value || "N/D";
}

function statusClass(status?: string | null) {
  const value = String(status || "").toLowerCase();

  if (value === "accepted") return "border-lime-400/30 bg-lime-400/10 text-lime-300";
  if (value === "pending") return "border-orange-400/30 bg-orange-400/10 text-orange-300";
  if (value === "rejected") return "border-red-400/30 bg-red-400/10 text-red-300";
  return "border-white/10 bg-white/[0.06] text-zinc-300";
}


function normId(value: any) {
  return String(value || "").trim();
}

function displayManagerName(item: any) {
  return (
    item.discord_name ||
    item.name ||
    item.manager_name ||
    item.real_name ||
    item.ea_id ||
    item.game_id ||
    "Player"
  );
}

function getClubForRegistration(item: any, clubs: any[] = []) {
  const direct = item.club_name || item.team_name;
  if (direct) return direct;

  const discordId = normId(item.discord_id);
  const club = clubs.find((c) => normId(c.assigned_to) === discordId);
  return club?.name || "";
}

function normalizeSiteText(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getRosterForRegistration(
  item: any,
  players: any[] = [],
  realAssignments: any[] = []
) {
  const discordId = normId(item.discord_id);

  const ownerRoster = players
    .filter((p) => normId(p.owner_discord_id) === discordId)
    .sort((a, b) => n(b.overall) - n(a.overall));

  // Se il database non ha ancora assegnato correttamente tutta la rosa,
  // usa come fallback il team reale salvato in real_team_assignments.
  // Appena il bot assegna correttamente i giocatori, prevale owner_discord_id.
  if (ownerRoster.length >= 10) return ownerRoster;

  const assignment = realAssignments.find((r) => normId(r.discord_id) === discordId);
  const realTeam = normalizeSiteText(assignment?.team_name);

  if (!realTeam) return ownerRoster;

  const fallbackRoster = players
    .filter((p) => normalizeSiteText(p.team) === realTeam)
    .sort((a, b) => n(b.overall) - n(a.overall));

  return fallbackRoster.length > ownerRoster.length ? fallbackRoster : ownerRoster;
}

function mergeRecentRegistrations(
  richieste: any[] = [],
  managers: any[] = [],
  clubs: any[] = []
) {
  const map = new Map<string, any>();

  for (const r of richieste || []) {
    const id = normId(r.discord_id);
    if (!id) continue;
    map.set(id, {
      ...r,
      source: "request",
      status: r.status || "pending",
      sortDate: r.handled_at || r.created_at || "",
    });
  }

  for (const m of managers || []) {
    const id = normId(m.discord_id);
    if (!id) continue;

    const assignedClub = clubs.find((c) => normId(c.assigned_to) === id);
    const previous = map.get(id) || {};

    map.set(id, {
      ...previous,
      ...m,
      discord_id: id,
      discord_name:
        previous.discord_name ||
        m.discord_tag ||
        m.username ||
        m.name ||
        m.manager_name ||
        id,
      club_name:
        m.club_name ||
        previous.club_name ||
        assignedClub?.name ||
        "",
      status:
        previous.status === "rejected"
          ? previous.status
          : "accepted",
      source: "manager",
      sortDate: previous.sortDate || m.created_at || assignedClub?.assigned_at || "",
    });
  }

  for (const c of clubs || []) {
    const id = normId(c.assigned_to);
    if (!id) continue;

    const previous = map.get(id) || {};
    map.set(id, {
      ...previous,
      discord_id: id,
      discord_name: previous.discord_name || previous.name || previous.manager_name || id,
      club_name: previous.club_name || c.name,
      status: previous.status || "accepted",
      source: previous.source || "club",
      sortDate: previous.sortDate || c.assigned_at || "",
    });
  }

  return Array.from(map.values())
    .sort((a, b) => String(b.sortDate || "").localeCompare(String(a.sortDate || "")))
    .slice(0, 8);
}

export default async function TorneoPage() {
  const { data: richieste } = await supabase
    .from("signup_requests")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: managers } = await supabase
    .from("managers")
    .select("*");

  const { data: clubs } = await supabase
    .from("fc26_clubs")
    .select("*");

  const { data: realAssignments } = await supabase
    .from("real_team_assignments")
    .select("*");

  const players = await fetchAllPlayersForRosters();

  const { data: auctions } = await supabase
    .from("auctions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(6);

  const { data: transfers } = await supabase
    .from("transfer_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(6);

  const accepted =
    richieste?.filter((r) => r.status === "accepted").length ?? 0;

  const pending =
    richieste?.filter((r) => r.status === "pending").length ?? 0;

  const rejected =
    richieste?.filter((r) => r.status === "rejected").length ?? 0;

  const totalRequests = richieste?.length ?? 0;
  const assignedClubs = clubs?.filter((club) => club.assigned_to).length ?? 0;
  const totalClubs = clubs?.length ?? 0;
  const assignedPlayers = players?.filter((p) => p.owner_discord_id).length ?? 0;
  const openAuctions = auctions?.filter((a) => a.status === "open").length ?? 0;
  const marketVolume =
    transfers?.reduce((sum, t) => sum + n(t.price), 0) ?? 0;

  const acceptedPct = pct(accepted, Math.max(totalRequests, 1));
  const clubsPct = pct(assignedClubs, Math.max(totalClubs, 1));

  const recentRequests = mergeRecentRegistrations(richieste || [], managers || [], clubs || []);
  const recentAuctions = auctions || [];
  const recentTransfers = transfers || [];

  return (
    <main className="min-h-screen overflow-hidden bg-[#020403] text-white">
      <AnalyticsTracker page="torneo" />

      <div className="fixed left-[-180px] top-[-180px] h-[480px] w-[480px] rounded-full bg-lime-400/20 blur-[150px]" />
      <div className="fixed right-[-180px] top-[220px] h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-[170px]" />
      <div className="fixed bottom-[-200px] left-[35%] h-[440px] w-[440px] rounded-full bg-cyan-400/10 blur-[160px]" />

      <header className="relative z-20 border-b border-lime-400/20 bg-black/75 px-4 md:px-6 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-4 md:flex-row md:items-center md:justify-between gap-4 md:p-6">
          <a href="/" className="flex items-center gap-4">
            <Image
              src="/logo-bordo-campo.png"
              alt="Bordo Campo"
              width={58}
              height={58}
              priority
            />

            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] md:tracking-[0.45em] text-lime-400">
                Bordo Campo
              </p>
              <h1 className="text-base md:text-xl md:text-3xl font-black uppercase tracking-widest">
                Torneo Hub
              </h1>
            </div>
          </a>

          <nav className="hidden items-center gap-3 lg:flex">
            <TopNav href="/" label="Home" />
            <TopNav href="/iscrizione" label="Iscrizioni" />
            <TopNav href="/torneo/classifiche" label="Classifiche" />
            <TopNav href="/torneo/calendario" label="Calendario" />
            <TopNav href="/torneo/risultati" label="Risultati" />
            <TopNav href="#regolamenti" label="Regolamenti" />
            <TopNav href="/torneo/mercato" label="Mercato" active />
          </nav>

          <a
            href="/staff"
            className="rounded-2xl border border-lime-400/35 bg-lime-400/10 px-5 py-3 text-sm font-black text-lime-300 transition hover:bg-lime-400 hover:text-black"
          >
            AREA STAFF
          </a>
        </div>
      </header>

      <section className="relative z-10 border-b border-lime-400/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(132,204,22,0.24),transparent_32%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-lime-400/10 via-black/40 to-black" />

        <div className="relative z-10 mx-auto grid max-w-[1700px] items-center gap-4 md:p-6 md:p-10 px-4 md:px-6 py-8 md:py-10 md:py-16 xl:grid-cols-[1fr_430px]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] md:tracking-[0.45em] text-lime-400">
              Bordo Campo Official Tournament
            </p>

            <h2 className="mt-5 text-2xl md:text-4xl md:text-6xl font-black leading-none md:text-base md:text-xl md:text-3xl md:text-5xl md:text-8xl">
              TORNEO
              <br />
              BC FC
            </h2>

            <p className="mt-6 max-w-3xl text-base md:text-lg leading-relaxed text-zinc-300">
              Dashboard centrale del torneo FC26: iscrizioni, club assegnati,
              mercato, classifiche, calendario, risultati e gestione live della
              competizione.
            </p>

            <div className="mt-10 grid max-w-4xl gap-4 md:grid-cols-4">
              <HeroMetric title="Iscritti" value={accepted} tone="lime" />
              <HeroMetric title="Club assegnati" value={`${assignedClubs}/${totalClubs}`} tone="cyan" />
              <HeroMetric title="Giocatori assegnati" value={assignedPlayers} tone="white" />
              <HeroMetric title="Aste aperte" value={openAuctions} tone="orange" />
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="/torneo/mercato"
                className="rounded-2xl bg-lime-400 px-5 py-4 md:px-4 md:px-8 font-black text-black shadow-[0_0_35px_rgba(132,204,22,0.35)] transition hover:scale-105"
              >
                APRI MERCATO
              </a>

              <a
                href="/iscrizione"
                className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 md:px-4 md:px-8 font-black backdrop-blur transition hover:border-lime-400 hover:text-lime-300"
              >
                ISCRIVITI AL TORNEO
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-lime-400/30 blur-[90px]" />
            <div className="relative overflow-hidden rounded-[1.5rem] md:rounded-[2rem] md:rounded-[2.5rem] border border-lime-400/25 bg-black/50 p-5 md:p-8 shadow-[0_0_80px_rgba(132,204,22,0.12)] backdrop-blur-xl">
              <Image
                src="/logo-bc-fc.png"
                alt="BC FC"
                width={360}
                height={360}
                priority
                className="mx-auto"
              />

              <div className="mt-6 rounded-3xl border border-lime-400/20 bg-lime-400/10 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.35em] text-lime-400">
                  Stato competizione
                </p>
                <p className="mt-3 text-base md:text-xl md:text-3xl font-black">
                  Iscrizioni aperte
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Staff operativo, assegnazione club attiva e mercato pronto per
                  la gestione del torneo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-[1700px] gap-5 md:p-8 px-4 md:px-6 py-8 md:py-10 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-6">
          <div className="rounded-[1.5rem] md:rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 md:p-6 backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.35em] text-lime-400">
              Torneo Menu
            </p>

            <div className="mt-6 grid gap-3">
              <MenuItem active href="/torneo" label="Dashboard" />
              <MenuItem href="/iscrizione" label="Iscrizioni" />
              <MenuItem href="/torneo/classifiche" label="Classifiche" />
              <MenuItem href="/torneo/calendario" label="Calendario" />
              <MenuItem href="/torneo/risultati" label="Risultati" />
              <MenuItem href="/torneo/mercato" label="Mercato" />
              <MenuItem href="/manager" label="Area Manager" />
            </div>
          </div>

          <div
            id="regolamenti"
            className="rounded-[1.5rem] md:rounded-[2rem] border border-lime-400/25 bg-gradient-to-br from-lime-400/10 via-white/[0.04] to-black p-4 md:p-6 backdrop-blur-xl"
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.35em] text-lime-400">
              Regolamenti
            </p>

            <div className="mt-6 grid gap-3">
              <a
                href="https://docs.google.com/document/d/1O3fNMuZZMhZgawz995HsOotnJMW67CT_69CDrFl4PuA/edit?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-2xl border border-white/10 bg-black/35 px-5 py-4 transition hover:border-lime-400/60 hover:bg-lime-400/10"
              >
                <p className="font-black uppercase text-white group-hover:text-lime-300">
                  Regolamento generale
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  Regole generali del torneo, iscrizioni, gestione squadre e comportamento.
                </p>
              </a>

              <a
                href="https://docs.google.com/document/d/19_nmkvd0krLhyXttODqzN0x8rwamJ4GNGY1x_fSDRJA/edit?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-2xl border border-white/10 bg-black/35 px-5 py-4 transition hover:border-lime-400/60 hover:bg-lime-400/10"
              >
                <p className="font-black uppercase text-white group-hover:text-lime-300">
                  Regolamento partita
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  Regole per disputare, confermare e contestare le partite.
                </p>
              </a>
            </div>
          </div>

          <PanelCard title="Avanzamento torneo">
            <ProgressRow label="Iscritti accettati" value={acceptedPct} />
            <ProgressRow label="Club assegnati" value={clubsPct} />
            <ProgressRow label="Mercato" value={openAuctions > 0 ? 100 : 30} />
          </PanelCard>
        </aside>

        <div className="grid gap-5 md:p-8">
          <div className="grid gap-4 md:p-6 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Accettati" value={accepted} color="text-lime-400" />
            <StatCard title="In attesa" value={pending} color="text-orange-400" />
            <StatCard title="Rifiutati" value={rejected} color="text-red-400" />
            <StatCard title="Volume mercato" value={marketVolume} color="text-cyan-400" />
          </div>

          <section className="grid gap-5 md:p-8 xl:grid-cols-[1fr_430px]">
            <div className="rounded-[1.5rem] md:rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-7 backdrop-blur-xl">
              <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.35em] text-lime-400">
                    Hub operativo
                  </p>
                  <h3 className="mt-2 text-2xl md:text-4xl font-black">
                    Sezioni torneo
                  </h3>
                </div>

                <p className="text-sm text-zinc-400">
                  Navigazione principale FC26
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FeatureCard
                  href="/torneo/mercato"
                  title="Mercato"
                  description="Aste live, giocatori liberi, budget manager e storico operazioni."
                  type="market"
                />
                <FeatureCard
                  href="/torneo/classifiche"
                  title="Classifiche"
                  description="Ranking torneo, punti, vittorie, pareggi, sconfitte e differenza reti."
                  type="standings"
                />
                <FeatureCard
                  href="/torneo/calendario"
                  title="Calendario"
                  description="Giornate, partite programmate, orari e prossimi match."
                  type="calendar"
                />
                <FeatureCard
                  href="/torneo/risultati"
                  title="Risultati"
                  description="Risultati ufficiali, marcatori e storico delle partite giocate."
                  type="results"
                />
                <FeatureCard
                  href="#regolamenti"
                  title="Regolamenti"
                  description="Consulta regolamento generale e regolamento partita ufficiali."
                  type="rules"
                />
              </div>
            </div>

            <PanelCard title="Aste recenti">
              <div className="space-y-3">
                {recentAuctions.length ? (
                  recentAuctions.map((a: any) => (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-white/10 bg-black/35 p-4"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="font-black">Asta #{a.id}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Player ID: {a.player_id}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${
                          a.status === "open"
                            ? "bg-lime-400 text-black"
                            : "bg-white/10 text-zinc-300"
                        }`}>
                          {a.status || "N/D"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-zinc-400">
                        Offerta: <b className="text-white">{a.highest_bid || 0}</b> crediti
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-400">
                    Nessuna asta recente trovata.
                  </p>
                )}
              </div>
            </PanelCard>
          </section>

          <section className="grid gap-5 md:p-8 xl:grid-cols-[1fr_430px]">
            <div className="rounded-[1.5rem] md:rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-7 backdrop-blur-xl">
              <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.35em] text-lime-400">
                    Registrazioni
                  </p>
                  <h3 className="mt-2 text-2xl md:text-4xl font-black">
                    Iscrizioni recenti
                  </h3>
                </div>

                <a
                  href="/staff"
                  className="hidden rounded-2xl border border-lime-400/30 px-5 py-3 text-sm font-black text-lime-300 transition hover:bg-lime-400 hover:text-black md:block"
                >
                  GESTISCI
                </a>
              </div>

              <div className="grid gap-4">
                {recentRequests.length ? (
                  recentRequests.map((r: any) => (
                    <div
                      key={r.id}
                      className="group rounded-[1.5rem] border border-white/10 bg-black/30 p-5 transition hover:border-lime-400/50 hover:bg-lime-400/5"
                    >
                      <div className="flex flex-col gap-4">
                        <div>
                          <h4 className="text-2xl font-black">
                            {r.discord_name || r.real_name || r.ea_id || r.game_id || "Player"}
                          </h4>

                          <p className="mt-1 text-sm text-zinc-400">
                            Discord ID: {r.discord_id}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3 md:justify-end">
                          <Badge>{r.platform || "N/D"}</Badge>
                          <Badge className={statusClass(r.status)}>
                            {statusLabel(r.status)}
                          </Badge>
                          {getClubForRegistration(r, clubs || []) && (
                            <ClubRosterBadge
                              clubName={getClubForRegistration(r, clubs || [])}
                              roster={getRosterForRegistration(r, players || [], realAssignments || [])}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-400">
                    Nessuna iscrizione trovata nel database.
                  </p>
                )}
              </div>
            </div>

            <PanelCard title="Ultime operazioni">
              <div className="space-y-3">
                {recentTransfers.length ? (
                  recentTransfers.map((t: any) => (
                    <div
                      key={t.id}
                      className="rounded-2xl border border-white/10 bg-black/35 p-4"
                    >
                      <p className="font-black">
                        {t.player_name || "Giocatore"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        Manager: {t.manager_name || t.manager_id || "N/D"}
                      </p>
                      <p className="mt-2 text-sm">
                        Prezzo: <b className="text-lime-400">{t.price || 0}</b> crediti
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-400">
                    Nessuna operazione recente.
                  </p>
                )}
              </div>
            </PanelCard>
          </section>
        </div>
      </section>
    </main>
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

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[1.5rem] md:rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-7 backdrop-blur-xl transition hover:-translate-y-1 hover:border-lime-400/50 hover:shadow-[0_0_45px_rgba(132,204,22,0.14)]">
      <div className="absolute -right-10 -top-4 md:p-6 md:p-10 h-32 w-32 rounded-full bg-lime-400/10 blur-2xl transition group-hover:bg-lime-400/20" />
      <p className="relative z-10 text-sm font-black uppercase tracking-[0.25em] text-zinc-500">
        {title}
      </p>

      <p className={`relative z-10 mt-4 text-2xl md:text-4xl md:text-6xl font-black ${color}`}>
        {value}
      </p>
    </div>
  );
}

function MenuItem({
  label,
  active,
  href,
}: {
  label: string;
  active?: boolean;
  href: string;
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

function FeatureCard({
  href,
  title,
  description,
  type,
}: {
  href: string;
  title: string;
  description: string;
  type: "market" | "standings" | "calendar" | "results" | "rules";
}) {
  return (
    <a
      href={href}
      className="group relative overflow-hidden rounded-[1.5rem] md:rounded-[2rem] border border-lime-400/25 bg-gradient-to-br from-lime-400/10 via-white/[0.03] to-black p-4 md:p-6 transition duration-300 hover:-translate-y-1 hover:border-lime-300 hover:shadow-[0_0_40px_rgba(132,204,22,0.18)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(132,204,22,0.20),transparent_45%)] opacity-80" />
      <div className="relative z-10 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/35 bg-black/55">
        <TorneoIcon type={type} />
      </div>

      <h4 className="relative z-10 text-2xl font-black uppercase">
        {title}
      </h4>

      <p className="relative z-10 mt-3 text-sm leading-relaxed text-zinc-400">
        {description}
      </p>
    </a>
  );
}

function PanelCard({
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

function ProgressRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm">
        <span className="font-bold text-zinc-300">{label}</span>
        <span className="font-black text-lime-400">{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-lime-400 shadow-[0_0_14px_rgba(132,204,22,0.70)]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}


function ClubRosterBadge({
  clubName,
  roster,
}: {
  clubName: string;
  roster: any[];
}) {
  const grouped = roster.reduce((acc: Record<string, any[]>, player: any) => {
    const role = String(player.position || "ALTRO").toUpperCase();
    const bucket =
      ["GK", "POR"].includes(role) ? "Portieri" :
      ["CB", "LB", "RB", "LWB", "RWB", "DC", "TS", "TD"].includes(role) ? "Difensori" :
      ["CDM", "CM", "CAM", "LM", "RM", "CDC", "CC", "MCO"].includes(role) ? "Centrocampisti" :
      ["ST", "CF", "LW", "RW", "LF", "RF", "ATT", "AS", "AD"].includes(role) ? "Attaccanti" :
      "Altri";
    acc[bucket] = acc[bucket] || [];
    acc[bucket].push(player);
    return acc;
  }, {});

  const order = ["Portieri", "Difensori", "Centrocampisti", "Attaccanti", "Altri"];

  return (
    <details className="w-full">
      <summary className="inline-flex cursor-pointer list-none items-center rounded-full border border-lime-400/40 bg-lime-400/10 px-4 py-2 text-sm font-black text-lime-300 transition hover:bg-lime-400 hover:text-black">
        {clubName} · rosa completa ({roster.length})
      </summary>

      <div className="mt-5 w-full rounded-[1.5rem] border border-lime-400/25 bg-black/45 p-5 shadow-[0_0_35px_rgba(132,204,22,0.12)]">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.30em] text-lime-400">
              Rosa aggiornata live
            </p>
            <h5 className="mt-1 text-2xl font-black text-white">{clubName}</h5>
          </div>
          <div className="rounded-2xl border border-lime-400/25 bg-lime-400/10 px-4 py-2 text-sm font-black text-lime-300">
            {roster.length} giocatori
          </div>
        </div>

        {roster.length ? (
          <div className="space-y-5">
            {order
              .filter((group) => grouped[group]?.length)
              .map((group) => (
                <div key={group}>
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-500">
                    {group}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {grouped[group].map((p: any) => (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-lime-400/40 hover:bg-lime-400/5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-black text-white">
                              {p.name || "Giocatore"}
                            </p>
                            <p className="mt-1 text-xs text-zinc-400">
                              {p.position || "N/D"} · {p.team || clubName}
                            </p>
                          </div>

                          <div className="shrink-0 rounded-xl bg-lime-400 px-3 py-2 text-sm font-black text-black">
                            {p.overall || "N/D"}
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-zinc-500">
                          Valore: <b className="text-zinc-300">{p.sold_price || 0}</b> crediti
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-400">
            Nessun giocatore assegnato a questa rosa.
          </p>
        )}
      </div>
    </details>
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
    <span className={`rounded-full border px-4 py-2 text-sm font-bold ${className}`}>
      {children}
    </span>
  );
}

function TorneoIcon({
  type,
}: {
  type: "market" | "standings" | "calendar" | "results" | "rules";
}) {
  if (type === "market") {
    return (
      <svg viewBox="0 0 96 96" className="h-11 w-11 text-lime-400" fill="none">
        <path d="M22 36h52l-5 38H27L22 36Z" fill="currentColor" opacity="0.18" />
        <path d="M22 36h52l-5 38H27L22 36Z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
        <path d="M34 36c0-10 5-18 14-18s14 8 14 18" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M38 53h20M38 64h14" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "standings") {
    return (
      <svg viewBox="0 0 96 96" className="h-11 w-11 text-lime-400" fill="none">
        <path d="M28 16h40v12c0 18-8 30-20 34-12-4-20-16-20-34V16Z" fill="currentColor" opacity="0.18" />
        <path d="M28 16h40v12c0 18-8 30-20 34-12-4-20-16-20-34V16Z" stroke="currentColor" strokeWidth="5" />
        <path d="M28 24H14v8c0 12 8 21 20 23M68 24h14v8c0 12-8 21-20 23M48 62v14M34 82h28" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "calendar") {
    return (
      <svg viewBox="0 0 96 96" className="h-11 w-11 text-lime-400" fill="none">
        <rect x="18" y="22" width="60" height="56" rx="10" fill="currentColor" opacity="0.14" />
        <rect x="18" y="22" width="60" height="56" rx="10" stroke="currentColor" strokeWidth="5" />
        <path d="M30 14v16M66 14v16M20 40h56M32 54h8M46 54h8M60 54h8M32 66h8M46 66h8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "rules") {
    return (
      <svg viewBox="0 0 96 96" className="h-11 w-11 text-lime-400" fill="none">
        <path d="M26 16h36l10 10v54H26V16Z" fill="currentColor" opacity="0.14" />
        <path d="M26 16h36l10 10v54H26V16Z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
        <path d="M60 16v14h12" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
        <path d="M36 42h24M36 54h24M36 66h14" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 96 96" className="h-11 w-11 text-lime-400" fill="none">
      <circle cx="48" cy="48" r="32" fill="currentColor" opacity="0.14" />
      <circle cx="48" cy="48" r="32" stroke="currentColor" strokeWidth="5" />
      <path d="M48 30l15 11-6 18H39l-6-18 15-11Z" fill="currentColor" opacity="0.28" stroke="currentColor" strokeWidth="4" />
      <path d="M48 30V16M63 41l15-5M57 59l8 14M39 59l-8 14M33 41l-15-5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
