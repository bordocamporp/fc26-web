import Image from "next/image";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "../api/auth/[...nextauth]/route";
import ClubLogo from "./ClubLogoClient";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function n(value: any) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calcBudget(avg: number) {
  if (avg >= 85) return 50;
  if (avg >= 82) return 80;
  if (avg >= 80) return 150;
  if (avg >= 78) return 350;
  if (avg >= 75) return 430;
  return 500;
}

function sameTeamFilter(team: string) {
  const clean = String(team || "").trim();

  const aliases: Record<string, string[]> = {
    "1860 München": ["1860 München", "TSV 1860 München", "1860 Munich"],
    "Bayern Monaco": ["Bayern Monaco", "Bayern Munich", "FC Bayern München", "FC Bayern Munich"],
    "Barcellona": ["Barcellona", "Barcelona", "FC Barcelona"],
    "PSG": ["PSG", "Paris Saint-Germain", "Paris SG"],
    "Manchester United": ["Manchester United", "Man United", "Man Utd"],
    "Manchester City": ["Manchester City", "Man City"],
    "RB Lipsia": ["RB Lipsia", "RB Leipzig"],
  };

  return aliases[clean] || [clean];
}

function ovrColor(overall: any) {
  const value = n(overall);

  if (value >= 85) return "from-yellow-300 to-orange-400 text-black";
  if (value >= 75) return "from-lime-300 to-lime-500 text-black";
  if (value >= 65) return "from-emerald-400 to-green-600 text-black";
  return "from-zinc-500 to-zinc-700 text-white";
}

function statPercent(value: any) {
  return Math.max(0, Math.min(100, n(value)));
}

async function getManagerData(discordId: string) {
  const cleanDiscordId = String(discordId || "").trim();

  const { data: manager } = await supabase
    .from("managers")
    .select("*")
    .eq("discord_id", cleanDiscordId)
    .maybeSingle();

  const { data: signup } = await supabase
    .from("signup_requests")
    .select("*")
    .eq("discord_id", cleanDiscordId)
    .eq("status", "accepted")
    .order("handled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: realAssignment } = await supabase
    .from("real_team_assignments")
    .select("*")
    .eq("discord_id", cleanDiscordId)
    .maybeSingle();

  const clubName =
    manager?.club_name ||
    signup?.club_name ||
    realAssignment?.team_name ||
    null;

  let club: any = null;

  if (clubName) {
    const { data: clubData } = await supabase
      .from("fc26_clubs")
      .select("*")
      .eq("name", clubName)
      .maybeSingle();

    club = clubData;
  }

  let roster: any[] = [];

  const { data: ownerPlayers } = await supabase
    .from("players")
    .select("*")
    .eq("owner_discord_id", cleanDiscordId)
    .order("overall", { ascending: false });

  if (ownerPlayers && ownerPlayers.length > 0) {
    roster = ownerPlayers;
  }

  if (roster.length === 0 && clubName) {
    const aliases = sameTeamFilter(clubName);

    for (const alias of aliases) {
      const { data: byTeamPlayers } = await supabase
        .from("players")
        .select("*")
        .eq("team", alias)
        .order("overall", { ascending: false });

      if (byTeamPlayers && byTeamPlayers.length > 0) {
        roster = byTeamPlayers;
        break;
      }
    }
  }

  if (roster.length === 0 && clubName) {
    const aliases = sameTeamFilter(clubName);

    for (const alias of aliases) {
      const { data: byTeamLikePlayers } = await supabase
        .from("players")
        .select("*")
        .ilike("team", `%${alias}%`)
        .order("overall", { ascending: false });

      if (byTeamLikePlayers && byTeamLikePlayers.length > 0) {
        roster = byTeamLikePlayers;
        break;
      }
    }
  }

  if (roster.length === 0 && clubName) {
    const aliases = sameTeamFilter(clubName);

    for (const alias of aliases) {
      const { data: byDatasetPlayers } = await supabase
        .from("players_fc26")
        .select("*")
        .eq("team", alias)
        .order("overall", { ascending: false });

      if (byDatasetPlayers && byDatasetPlayers.length > 0) {
        roster = byDatasetPlayers;
        break;
      }
    }
  }

  return {
    manager,
    signup,
    realAssignment,
    club,
    clubName,
    roster,
  };
}

export default async function ManagerPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as any;

  const discordId = String(
    user.discordId ||
    user.discord_id ||
    user.id ||
    ""
  ).trim();

  if (!discordId) {
    redirect("/login");
  }

  const { manager, realAssignment, club, clubName, roster } =
    await getManagerData(discordId);

  const avgOverall =
    roster.length > 0
      ? Math.round(roster.reduce((sum, p) => sum + n(p.overall), 0) / roster.length)
      : 0;

  const budget =
    manager?.budget ||
    realAssignment?.assigned_budget ||
    calcBudget(avgOverall);

  const bestPlayer = roster[0];

  const roleCounts = roster.reduce(
    (acc: Record<string, number>, p: any) => {
      const pos = String(p.position || "ALTRO").toUpperCase();
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#020403] text-white">
      <div className="fixed left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-lime-400/20 blur-[140px]" />
      <div className="fixed bottom-[-180px] right-[-120px] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-[140px]" />

      <header className="relative z-10 border-b border-lime-400/20 bg-black/85 px-8 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6">
          <a href="/" className="flex items-center gap-4">
            <Image src="/logo-bordo-campo.png" alt="BC" width={54} height={54} />

            <div>
              <p className="text-xs font-black uppercase tracking-[0.4em] text-lime-400">
                Bordo Campo Manager Hub
              </p>
              <h1 className="text-3xl font-black tracking-widest">
                AREA MANAGER
              </h1>
            </div>
          </a>

          <div className="text-right">
            <p className="font-black">{session.user?.name}</p>
            <p className="text-sm text-zinc-400">Discord ID: {discordId}</p>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-[1600px] px-6 py-8">
        {!clubName ? (
          <div className="rounded-[2rem] border border-orange-400/30 bg-orange-400/10 p-10">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-orange-400">
              Nessun club assegnato
            </p>

            <h2 className="mt-4 text-5xl font-black">
              Non hai ancora una squadra
            </h2>

            <p className="mt-4 max-w-3xl text-zinc-300">
              Quando lo staff accetterà la tua iscrizione e ti assegnerà un club,
              qui vedrai rosa, budget, overall e dati manager.
            </p>

            <div className="mt-8">
              <a
                href="/iscrizione"
                className="inline-flex items-center justify-center rounded-2xl bg-lime-400 px-8 py-4 text-lg font-black text-black shadow-[0_0_35px_rgba(132,204,22,0.35)] transition hover:scale-105 hover:bg-lime-300"
              >
                ISCRIVITI AL TORNEO FC
              </a>
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[1fr_390px]">
              <div className="relative overflow-hidden rounded-[2.5rem] border border-lime-400/25 bg-gradient-to-br from-lime-400/15 via-white/[0.04] to-black p-8 shadow-[0_0_80px_rgba(132,204,22,0.10)]">
                <div className="absolute right-[-120px] top-[-140px] h-[360px] w-[360px] rounded-full bg-lime-400/20 blur-[120px]" />

                <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.4em] text-lime-400">
                      Club assegnato
                    </p>

                    <h2 className="mt-4 text-5xl font-black leading-none md:text-7xl">
                      {clubName}
                    </h2>

                    <p className="mt-5 max-w-2xl text-zinc-300">
                      Dashboard collegata allo stesso database usato dal bot Discord.
                    </p>
                  </div>

                  <ClubLogo clubName={clubName} logoUrl={club?.logo_url} />
                </div>

                <div className="relative z-10 mt-8 grid gap-4 sm:grid-cols-4">
                  <Stat title="Giocatori" value={roster.length} color="text-white" />
                  <Stat title="OVR medio" value={avgOverall} color="text-lime-400" />
                  <Stat title="Budget" value={budget} color="text-cyan-400" />
                  <Stat title="Status" value="Attivo" color="text-orange-400" />
                </div>
              </div>

              <TopPlayerCard player={bestPlayer} />
            </section>

            <section className="mt-8 grid gap-8 xl:grid-cols-[320px_1fr]">
              <aside className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
                <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                  Rosa riepilogo
                </p>

                <div className="mt-6 space-y-3">
                  {Object.entries(roleCounts).slice(0, 12).map(([role, count]) => (
                    <div
                      key={role}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                    >
                      <span className="font-black">{role}</span>
                      <span className="text-lime-400">{String(count)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-4">
                  <ManagerSideButton
                    href="/torneo/classifiche"
                    title="CLASSIFICHE"
                    description="Visualizza la classifica aggiornata del torneo."
                    icon="trophy"
                  />

                  <ManagerSideButton
                    href="/torneo/calendario"
                    title="CALENDARIO"
                    description="Controlla le prossime partite e gli eventi."
                    icon="calendar"
                  />

                  <ManagerSideButton
                    href="/torneo/risultati"
                    title="RISULTATI"
                    description="Guarda gli ultimi risultati delle partite."
                    icon="ball"
                  />
                </div>
              </aside>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
                <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                      Rosa ufficiale
                    </p>

                    <h3 className="mt-2 text-4xl font-black">
                      {roster.length} giocatori
                    </h3>
                  </div>

                  <p className="text-sm text-zinc-400">
                    Ordinati per overall
                  </p>
                </div>

                {roster.length === 0 ? (
                  <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-6 text-red-100">
                    Nessun giocatore trovato. Discord ID rilevato: <b>{discordId}</b>.
                    Club rilevato: <b>{clubName}</b>.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {roster.map((player: any) => (
                      <PlayerCard key={player.id} player={player} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function TopPlayerCard({ player }: { player: any }) {
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/60 p-6 backdrop-blur-xl">
      <div className="absolute right-[-80px] top-[-80px] h-[220px] w-[220px] rounded-full bg-lime-400/10 blur-[80px]" />

      <p className="relative z-10 text-xs font-black uppercase tracking-[0.35em] text-lime-400">
        Top player
      </p>

      {player ? (
        <div className="relative z-10 mt-5">
          <div className="mx-auto flex h-48 w-48 items-end justify-center overflow-hidden rounded-[2rem] border border-lime-400/20 bg-gradient-to-b from-lime-400/20 to-black">
            {player.image_url ? (
              <img
                src={player.image_url}
                alt={player.name}
                className="h-44 object-contain"
              />
            ) : (
              <div className="mb-8 text-6xl">👤</div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-3xl font-black">{player.name}</h3>
              <p className="mt-1 text-zinc-400">
                {player.position || "N/D"} • {player.nation || player.nationality || "N/D"}
              </p>
            </div>

            <div className={`rounded-2xl bg-gradient-to-br px-5 py-4 text-3xl font-black ${ovrColor(player.overall)}`}>
              {player.overall || "—"}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <MiniStat label="PAC" value={player.pace ?? player.pac} />
            <MiniStat label="SHO" value={player.shooting ?? player.sho} />
            <MiniStat label="PAS" value={player.passing ?? player.pas} />
            <MiniStat label="DRI" value={player.dribbling ?? player.dri} />
            <MiniStat label="DEF" value={player.defending ?? player.def} />
            <MiniStat label="PHY" value={player.physical ?? player.phy} />
          </div>
        </div>
      ) : (
        <p className="relative z-10 mt-4 text-zinc-400">
          Nessun giocatore trovato.
        </p>
      )}
    </div>
  );
}

function PlayerCard({ player }: { player: any }) {
  const pace = player.pace ?? player.pac;
  const shooting = player.shooting ?? player.sho;
  const passing = player.passing ?? player.pas;
  const dribbling = player.dribbling ?? player.dri;
  const defending = player.defending ?? player.def;
  const physical = player.physical ?? player.phy;

  return (
    <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/50 p-5 transition duration-300 hover:-translate-y-1 hover:border-lime-400/60 hover:shadow-[0_0_45px_rgba(132,204,22,0.18)]">
      <div className="absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-lime-400/10 blur-[55px] transition group-hover:bg-lime-400/20" />

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
            <div>
              <h4 className="truncate text-xl font-black">{player.name}</h4>
              <p className="mt-1 text-sm text-zinc-400">
                {player.position || "N/D"} • {player.nation || player.nationality || "N/D"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {player.team || ""}
              </p>
            </div>

            <div className={`rounded-2xl bg-gradient-to-br px-4 py-3 text-2xl font-black ${ovrColor(player.overall)}`}>
              {player.overall || "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-5 grid gap-3">
        <StatBar label="PAC" value={pace} />
        <StatBar label="SHO" value={shooting} />
        <StatBar label="PAS" value={passing} />
        <StatBar label="DRI" value={dribbling} />
        <StatBar label="DEF" value={defending} />
        <StatBar label="PHY" value={physical} />
      </div>

      <div className="relative z-10 mt-5 flex flex-wrap gap-2 text-xs text-zinc-400">
        {player.age && <Badge>{player.age} anni</Badge>}
        {player.weak_foot && <Badge>WF {player.weak_foot}</Badge>}
        {player.skill_moves && <Badge>SM {player.skill_moves}</Badge>}
        {player.market_value !== undefined && <Badge>Valore {player.market_value}</Badge>}
      </div>
    </article>
  );
}

function ManagerSideButton({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: "trophy" | "calendar" | "ball";
}) {
  return (
    <a
      href={href}
      className="group relative block overflow-hidden rounded-[1.8rem] border border-lime-400/40 bg-gradient-to-br from-lime-400/15 via-white/[0.03] to-black p-5 transition duration-300 hover:-translate-y-1 hover:border-lime-300 hover:shadow-[0_0_38px_rgba(132,204,22,0.24)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(132,204,22,0.20),transparent_45%)] opacity-80" />
      <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-lime-400/10 blur-2xl transition group-hover:bg-lime-400/20" />
      <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-lime-400/70 via-lime-400/20 to-transparent" />

      <div className="relative z-10">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[1.4rem] border border-lime-400/35 bg-black/55 shadow-[inset_0_0_18px_rgba(132,204,22,0.12),0_0_20px_rgba(132,204,22,0.12)] transition group-hover:scale-105">
          <ManagerIcon type={icon} />
        </div>

        <h4 className="text-xl font-black uppercase tracking-wide text-white">
          {title}
        </h4>

        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {description}
        </p>
      </div>
    </a>
  );
}

function ManagerIcon({ type }: { type: "trophy" | "calendar" | "ball" }) {
  if (type === "trophy") {
    return (
      <svg
        viewBox="0 0 96 96"
        className="h-16 w-16 text-lime-400 drop-shadow-[0_0_14px_rgba(132,204,22,0.55)]"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M28 16h40v12c0 18-8 30-20 34-12-4-20-16-20-34V16Z"
          fill="currentColor"
          opacity="0.18"
        />
        <path
          d="M28 16h40v12c0 18-8 30-20 34-12-4-20-16-20-34V16Z"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M28 24H14v8c0 12 8 21 20 23M68 24h14v8c0 12-8 21-20 23"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M48 62v12M34 80h28M26 88h44"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M42 30l6-5 6 5-2 8h-8l-2-8Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (type === "calendar") {
    return (
      <svg
        viewBox="0 0 96 96"
        className="h-16 w-16 text-lime-400 drop-shadow-[0_0_14px_rgba(132,204,22,0.55)]"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="18"
          y="22"
          width="60"
          height="56"
          rx="10"
          fill="currentColor"
          opacity="0.14"
        />
        <rect
          x="18"
          y="22"
          width="60"
          height="56"
          rx="10"
          stroke="currentColor"
          strokeWidth="5"
        />
        <path
          d="M30 14v16M66 14v16M20 40h56"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M32 52h8M46 52h8M60 52h8M32 64h8M46 64h8M60 64h8"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 96 96"
      className="h-16 w-16 text-lime-400 drop-shadow-[0_0_14px_rgba(132,204,22,0.55)]"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="48"
        cy="48"
        r="32"
        fill="currentColor"
        opacity="0.14"
      />
      <circle
        cx="48"
        cy="48"
        r="32"
        stroke="currentColor"
        strokeWidth="5"
      />
      <path
        d="M48 30l15 11-6 18H39l-6-18 15-11Z"
        fill="currentColor"
        opacity="0.28"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M48 30V16M63 41l15-5M57 59l8 14M39 59l-8 14M33 41l-15-5"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}


function StatBar({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
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

function Stat({
  title,
  value,
  color,
}: {
  title: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
        {title}
      </p>

      <p className={`mt-3 text-4xl font-black ${color}`}>
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number | string | null;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-center">
      <p className="text-[10px] font-black text-zinc-500">{label}</p>
      <p className="text-lg font-black text-white">{value || "—"}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1">
      {children}
    </span>
  );
}
