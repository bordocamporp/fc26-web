import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "../../api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type CalendarMatch = {
  id: string | number;
  source_table: string;
  competition_name: string;
  competition_type: "Campionato" | "Coppa";
  round: string;
  leg?: string | null;
  home_id?: string | null;
  away_id?: string | null;
  home_club: string;
  away_club: string;
  home_goals?: number | null;
  away_goals?: number | null;
  status?: string | null;
};

function clean(value: any) {
  return String(value || "").trim();
}

function n(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusLabel(match: CalendarMatch) {
  const status = clean(match.status || "pending").toLowerCase();

  if (status === "confirmed" || status === "played" || status === "giocata") {
    return {
      label: "Giocata",
      className: "bg-lime-400 text-black",
    };
  }

  if (status === "awaiting_confirmation") {
    return {
      label: "In attesa conferma",
      className: "bg-yellow-300 text-black",
    };
  }

  if (status === "contested") {
    return {
      label: "Contestata",
      className: "bg-red-500 text-white",
    };
  }

  if (status === "cancelled" || status === "annullata") {
    return {
      label: "Annullata",
      className: "bg-zinc-600 text-white",
    };
  }

  return {
    label: "Da disputare",
    className: "bg-white/10 text-zinc-300",
  };
}

function hasResult(match: CalendarMatch) {
  return n(match.home_goals) !== null && n(match.away_goals) !== null;
}

function resultText(match: CalendarMatch) {
  if (!hasResult(match)) return "VS";
  return `${n(match.home_goals)} - ${n(match.away_goals)}`;
}

function isUserMatch(match: CalendarMatch, discordId: string) {
  return clean(match.home_id) === discordId || clean(match.away_id) === discordId;
}

function normalizeChampionshipMatch(row: any): CalendarMatch {
  return {
    id: row.id,
    source_table: "championship_matches",
    competition_name:
      row.championships?.name ||
      row.competition_name ||
      row.name ||
      "Campionato",
    competition_type: "Campionato",
    round: row.round || row.round_name || (row.round_number ? `Giornata ${row.round_number}` : "Giornata"),
    leg: row.leg || row.phase || null,
    home_id: clean(row.home_id || row.home_user_id || row.home_discord_id || row.home_manager_id),
    away_id: clean(row.away_id || row.away_user_id || row.away_discord_id || row.away_manager_id),
    home_club: row.home_name || row.home_club || row.home_team || "Casa",
    away_club: row.away_name || row.away_club || row.away_team || "Trasferta",
    home_goals: row.home_goals,
    away_goals: row.away_goals,
    status: row.status || "pending",
  };
}

function normalizeCupMatch(row: any, table: string, fallbackName: string): CalendarMatch {
  return {
    id: row.id,
    source_table: table,
    competition_name:
      row.national_cups?.name ||
      row.european_cups?.name ||
      row.competition_name ||
      row.name ||
      fallbackName,
    competition_type: "Coppa",
    round: row.round || row.round_name || (row.round_number ? `Turno ${row.round_number}` : "Turno"),
    leg: row.leg || row.phase || null,
    home_id: clean(row.home_id || row.home_user_id || row.home_discord_id || row.home_manager_id),
    away_id: clean(row.away_id || row.away_user_id || row.away_discord_id || row.away_manager_id),
    home_club: row.home_name || row.home_club || row.home_team || "Casa",
    away_club: row.away_name || row.away_club || row.away_team || "Trasferta",
    home_goals: row.home_goals,
    away_goals: row.away_goals,
    status: row.status || "pending",
  };
}

async function getChampionshipMatches(discordId: string) {
  const variants = [
    `home_id.eq.${discordId},away_id.eq.${discordId}`,
    `home_user_id.eq.${discordId},away_user_id.eq.${discordId}`,
    `home_discord_id.eq.${discordId},away_discord_id.eq.${discordId}`,
    `home_manager_id.eq.${discordId},away_manager_id.eq.${discordId}`,
  ];

  for (const orFilter of variants) {
    const { data, error } = await supabase
      .from("championship_matches")
      .select("*, championships(name)")
      .or(orFilter)
      .order("round_number", { ascending: true });

    if (!error && data) {
      return data.map(normalizeChampionshipMatch);
    }
  }

  return [];
}

async function getNationalCupMatches(discordId: string) {
  const variants = [
    `home_id.eq.${discordId},away_id.eq.${discordId}`,
    `home_user_id.eq.${discordId},away_user_id.eq.${discordId}`,
    `home_discord_id.eq.${discordId},away_discord_id.eq.${discordId}`,
    `home_manager_id.eq.${discordId},away_manager_id.eq.${discordId}`,
  ];

  for (const orFilter of variants) {
    const { data, error } = await supabase
      .from("national_cup_matches")
      .select("*, national_cups(name)")
      .or(orFilter)
      .order("round_number", { ascending: true });

    if (!error && data) {
      return data.map((row: any) =>
        normalizeCupMatch(row, "national_cup_matches", "Coppa Nazionale")
      );
    }
  }

  return [];
}

async function getEuropeanCupMatches(discordId: string) {
  const variants = [
    `home_id.eq.${discordId},away_id.eq.${discordId}`,
    `home_user_id.eq.${discordId},away_user_id.eq.${discordId}`,
    `home_discord_id.eq.${discordId},away_discord_id.eq.${discordId}`,
    `home_manager_id.eq.${discordId},away_manager_id.eq.${discordId}`,
  ];

  for (const orFilter of variants) {
    const { data, error } = await supabase
      .from("european_cup_matches")
      .select("*, european_cups(name)")
      .or(orFilter)
      .order("round_number", { ascending: true });

    if (!error && data) {
      return data.map((row: any) =>
        normalizeCupMatch(row, "european_cup_matches", "Coppa Europea")
      );
    }
  }

  return [];
}

async function getGenericCupMatches(discordId: string) {
  const variants = [
    `home_id.eq.${discordId},away_id.eq.${discordId}`,
    `home_user_id.eq.${discordId},away_user_id.eq.${discordId}`,
    `home_discord_id.eq.${discordId},away_discord_id.eq.${discordId}`,
    `home_manager_id.eq.${discordId},away_manager_id.eq.${discordId}`,
  ];

  for (const orFilter of variants) {
    const { data, error } = await supabase
      .from("cup_matches")
      .select("*")
      .or(orFilter)
      .order("id", { ascending: true });

    if (!error && data) {
      return data.map((row: any) =>
        normalizeCupMatch(row, "cup_matches", "Coppa")
      );
    }
  }

  return [];
}

function groupByCompetition(matches: CalendarMatch[]) {
  return matches.reduce((acc: Record<string, CalendarMatch[]>, match) => {
    const key = match.competition_name || match.competition_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {});
}

function MatchCard({
  match,
  discordId,
}: {
  match: CalendarMatch;
  discordId: string;
}) {
  const status = statusLabel(match);
  const userHome = clean(match.home_id) === discordId;
  const userAway = clean(match.away_id) === discordId;

  return (
    <article
      className={`rounded-[1.6rem] border p-4 transition ${
        hasResult(match)
          ? "border-lime-400/30 bg-lime-400/10"
          : "border-white/10 bg-black/45 hover:border-lime-400/40"
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-lime-400">
            {match.round}
          </p>
          {match.leg && (
            <p className="mt-1 text-xs text-zinc-500">{match.leg}</p>
          )}
        </div>

        <span className={`rounded-full px-3 py-1 text-xs font-black ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_90px_1fr] items-center gap-3">
        <div className={`min-w-0 rounded-2xl border px-4 py-3 ${
          userHome ? "border-lime-400/50 bg-lime-400/10" : "border-white/10 bg-white/[0.035]"
        }`}>
          <p className="truncate text-base font-black">{match.home_club}</p>
          {userHome && <p className="mt-1 text-[10px] font-black uppercase text-lime-400">Tu</p>}
        </div>

        <div className={`rounded-2xl px-3 py-4 text-center text-xl font-black ${
          hasResult(match) ? "bg-lime-400 text-black" : "bg-white/10 text-white"
        }`}>
          {resultText(match)}
        </div>

        <div className={`min-w-0 rounded-2xl border px-4 py-3 text-right ${
          userAway ? "border-lime-400/50 bg-lime-400/10" : "border-white/10 bg-white/[0.035]"
        }`}>
          <p className="truncate text-base font-black">{match.away_club}</p>
          {userAway && <p className="mt-1 text-[10px] font-black uppercase text-lime-400">Tu</p>}
        </div>
      </div>

      {hasResult(match) ? (
        <p className="mt-4 text-sm text-zinc-400">
          Risultato aggiornato automaticamente dalla procedura risultati.
        </p>
      ) : (
        <a
          href="/torneo/risultati"
          className="mt-4 inline-flex rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-black transition hover:scale-105"
        >
          INSERISCI RISULTATO
        </a>
      )}
    </article>
  );
}

function CompetitionBlock({
  title,
  matches,
  discordId,
}: {
  title: string;
  matches: CalendarMatch[];
  discordId: string;
}) {
  const played = matches.filter(hasResult).length;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-7">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.32em] text-lime-400">
            {title}
          </p>
          <h2 className="mt-2 text-3xl font-black">
            {matches.length} partite
          </h2>
        </div>

        <p className="text-sm text-zinc-400">
          Giocate {played}/{matches.length}
        </p>
      </div>

      <div className="grid gap-4">
        {matches.map((match) => (
          <MatchCard
            key={`${match.source_table}-${match.id}`}
            match={match}
            discordId={discordId}
          />
        ))}
      </div>
    </section>
  );
}

export default async function CalendarioPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as any;

  const discordId = clean(
    user.discordId ||
    user.discord_id ||
    user.id ||
    ""
  );

  if (!discordId) {
    redirect("/login");
  }

  const [championshipMatches, nationalCupMatches, europeanCupMatches, genericCupMatches] =
    await Promise.all([
      getChampionshipMatches(discordId),
      getNationalCupMatches(discordId),
      getEuropeanCupMatches(discordId),
      getGenericCupMatches(discordId),
    ]);

  const campionato = championshipMatches;
  const coppe = [
    ...nationalCupMatches,
    ...europeanCupMatches,
    ...genericCupMatches,
  ];

  const campionatiGrouped = groupByCompetition(campionato);
  const coppeGrouped = groupByCompetition(coppe);

  const totalMatches = campionato.length + coppe.length;
  const playedMatches = [...campionato, ...coppe].filter(hasResult).length;

  return (
    <main className="min-h-screen bg-[#020403] text-white">
      <div className="fixed left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-lime-400/20 blur-[140px]" />
      <div className="fixed bottom-[-180px] right-[-120px] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-[140px]" />

      <header className="relative z-10 border-b border-lime-400/20 bg-black/85 px-4 py-8 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
              Area Manager
            </p>
            <h1 className="mt-3 text-5xl font-black uppercase leading-none md:text-7xl">
              Calendario
            </h1>
            <p className="mt-4 max-w-3xl text-zinc-400">
              Qui trovi tutte le partite da disputare divise tra campionato e coppe.
              Quando una partita viene confermata dai risultati, resta visibile e viene aggiornata con il punteggio.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="/manager"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center text-sm font-black uppercase tracking-wider text-white transition hover:border-lime-400 hover:text-lime-400"
            >
              Torna manager
            </a>

            <a
              href="/torneo/risultati"
              className="rounded-2xl bg-lime-400 px-6 py-4 text-center text-sm font-black uppercase tracking-wider text-black transition hover:scale-105 hover:bg-lime-300"
            >
              Inserisci risultati
            </a>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-[1500px] px-4 py-8 md:px-8">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
              Totale partite
            </p>
            <p className="mt-3 text-4xl font-black">{totalMatches}</p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
              Giocate
            </p>
            <p className="mt-3 text-4xl font-black text-lime-400">{playedMatches}</p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
              Da disputare
            </p>
            <p className="mt-3 text-4xl font-black text-orange-400">
              {totalMatches - playedMatches}
            </p>
          </div>
        </div>

        {totalMatches === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-zinc-400">
            Nessuna partita trovata per il tuo account.
          </div>
        ) : (
          <div className="grid gap-8">
            <section>
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                  Campionato
                </p>
                <h2 className="mt-2 text-4xl font-black">Partite campionato</h2>
              </div>

              {Object.keys(campionatiGrouped).length === 0 ? (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-zinc-400">
                  Nessuna partita di campionato.
                </div>
              ) : (
                <div className="grid gap-6">
                  {Object.entries(campionatiGrouped).map(([name, matches]) => (
                    <CompetitionBlock
                      key={name}
                      title={name}
                      matches={matches}
                      discordId={discordId}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                  Coppe
                </p>
                <h2 className="mt-2 text-4xl font-black">Partite coppe</h2>
              </div>

              {Object.keys(coppeGrouped).length === 0 ? (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-zinc-400">
                  Nessuna partita di coppa.
                </div>
              ) : (
                <div className="grid gap-6">
                  {Object.entries(coppeGrouped).map(([name, matches]) => (
                    <CompetitionBlock
                      key={name}
                      title={name}
                      matches={matches}
                      discordId={discordId}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
