import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type StandingRow = {
  id: number | string;
  competition_name: string | null;
  competition_type: string | null;
  club_name: string | null;
  logo_url?: string | null;
  played?: number | null;
  wins?: number | null;
  draws?: number | null;
  losses?: number | null;
  goals_for?: number | null;
  goals_against?: number | null;
  points?: number | null;
};

async function getStandings() {
  const { data, error } = await supabase
    .from("standings")
    .select("*")
    .order("points", { ascending: false });

  if (error) {
    console.error("STANDINGS ERROR:", error);
    return [];
  }

  return (data || []) as StandingRow[];
}

function groupCompetition(type: string | null) {
  const value = String(type || "").toLowerCase().trim();

  if (value === "campionati") return "Campionati";
  if (value === "coppe europee") return "Coppe Europee";
  if (value === "coppa nazionale") return "Coppa Nazionale";

  if (
    value.includes("champions") ||
    value.includes("europa") ||
    value.includes("europe") ||
    value.includes("conference")
  ) {
    return "Coppe Europee";
  }

  if (value.includes("coppa") || value.includes("nazionale")) {
    return "Coppa Nazionale";
  }

  return "Campionati";
}

function groupByCompetition(rows: StandingRow[]) {
  return Array.from(new Set(rows.map((x) => x.competition_name || "Competizione"))).map(
    (competition) => ({
      competition,
      clubs: rows.filter((x) => (x.competition_name || "Competizione") === competition),
    })
  );
}

function scoreText(row: StandingRow) {
  const gf = Number(row.goals_for || 0);
  const ga = Number(row.goals_against || 0);

  if (gf === 0 && ga === 0) return "vs";
  return `${gf} - ${ga}`;
}

function resultStatus(row: StandingRow) {
  const gf = Number(row.goals_for || 0);
  const ga = Number(row.goals_against || 0);

  if (gf === 0 && ga === 0) return "Da giocare";
  if (gf > ga) return "Qualificata";
  if (gf < ga) return "Eliminata";
  return "Pareggio";
}

export default async function ClassifichePage() {
  const standings = await getStandings();

  const grouped = {
    Campionati: standings.filter(
      (x) => groupCompetition(x.competition_type) === "Campionati"
    ),

    "Coppe Europee": standings.filter(
      (x) => groupCompetition(x.competition_type) === "Coppe Europee"
    ),

    "Coppa Nazionale": standings.filter(
      (x) => groupCompetition(x.competition_type) === "Coppa Nazionale"
    ),
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-lime-500/20 px-4 md:px-6 py-8 md:py-10 md:py-14">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 md:p-6">
          <div className="flex items-center gap-5">
            <Image
              src="/logo-bordo-campo.png"
              alt="BC"
              width={70}
              height={70}
              className="object-contain"
              priority
            />

            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] md:tracking-[0.4em] text-lime-400">
                Torneo BC FC
              </p>

              <h1 className="mt-2 text-base md:text-xl md:text-3xl md:text-5xl font-black uppercase">
                Classifiche
              </h1>
            </div>
          </div>

          <Link
            href="/torneo"
            className="rounded-2xl bg-lime-400 px-4 py-4 md:px-4 md:px-8 md:py-5 text-base md:text-lg font-black text-black transition hover:scale-105"
          >
            TORNA AL TORNEO
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-4 md:px-6 py-8 md:py-10 md:py-16">
        <CompetitionSection
          category="Campionati"
          rows={grouped.Campionati}
          mode="table"
        />

        <CompetitionSection
          category="Coppe Europee"
          rows={grouped["Coppe Europee"]}
          mode="table"
        />

        <CompetitionSection
          category="Coppa Nazionale"
          rows={grouped["Coppa Nazionale"]}
          mode="bracket"
        />
      </div>
    </main>
  );
}

function CompetitionSection({
  category,
  rows,
  mode,
}: {
  category: string;
  rows: StandingRow[];
  mode: "table" | "bracket";
}) {
  const competitions = groupByCompetition(rows);

  return (
    <section>
      <div className="mb-10">
        <p className="text-sm font-black uppercase tracking-[0.22em] md:tracking-[0.4em] text-lime-400">
          BC FC
        </p>

        <h2 className="mt-3 text-2xl md:text-4xl md:text-6xl font-black">{category}</h2>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[1.5rem] md:rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 md:p-6 md:p-10 text-base md:text-xl text-zinc-400">
          Nessuna classifica disponibile.
        </div>
      ) : (
        <div className="space-y-10">
          {competitions.map(({ competition, clubs }) =>
            mode === "bracket" ? (
              <CupBracket key={competition} competition={competition} clubs={clubs} />
            ) : (
              <StandingTable key={competition} competition={competition} clubs={clubs} />
            )
          )}
        </div>
      )}
    </section>
  );
}

function StandingTable({
  competition,
  clubs,
}: {
  competition: string;
  clubs: StandingRow[];
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] md:rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-xl">
      <div className="border-b border-white/10 px-4 md:px-8 py-6">
        <h3 className="text-base md:text-xl md:text-3xl font-black">{competition}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-white/10 text-sm uppercase tracking-[0.2em] text-zinc-500">
              <th className="px-4 md:px-6 py-5 text-left">#</th>
              <th className="px-4 md:px-6 py-5 text-left">Club</th>
              <th className="px-4 py-5 text-center">PG</th>
              <th className="px-4 py-5 text-center">V</th>
              <th className="px-4 py-5 text-center">N</th>
              <th className="px-4 py-5 text-center">P</th>
              <th className="px-4 py-5 text-center">GF</th>
              <th className="px-4 py-5 text-center">GS</th>
              <th className="px-4 md:px-6 py-5 text-center">PT</th>
            </tr>
          </thead>

          <tbody>
            {clubs.map((club, index) => (
              <tr
                key={club.id}
                className="border-b border-white/5 transition hover:bg-lime-400/5"
              >
                <td className="px-4 md:px-6 py-5">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl font-black ${
                      index === 0 ? "bg-lime-400 text-black" : "bg-white/10"
                    }`}
                  >
                    {index + 1}
                  </div>
                </td>

                <td className="px-4 md:px-6 py-5">
                  <ClubCell club={club} />
                </td>

                <td className="px-4 py-5 text-center">{club.played || 0}</td>
                <td className="px-4 py-5 text-center text-lime-400">{club.wins || 0}</td>
                <td className="px-4 py-5 text-center">{club.draws || 0}</td>
                <td className="px-4 py-5 text-center text-red-400">{club.losses || 0}</td>
                <td className="px-4 py-5 text-center">{club.goals_for || 0}</td>
                <td className="px-4 py-5 text-center">{club.goals_against || 0}</td>

                <td className="px-4 md:px-6 py-5 text-center">
                  <div className="inline-flex rounded-xl bg-lime-400 px-4 py-2 font-black text-black">
                    {club.points || 0}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CupBracket({
  competition,
  clubs,
}: {
  competition: string;
  clubs: StandingRow[];
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] md:rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-xl">
      <div className="border-b border-white/10 px-4 md:px-8 py-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.35em] text-orange-400">
          Tabellone eliminazione diretta
        </p>
        <h3 className="mt-2 text-base md:text-xl md:text-3xl font-black">{competition}</h3>
      </div>

      <div className="grid gap-4 md:p-6 p-4 md:p-6 md:grid-cols-2 xl:grid-cols-4">
        <BracketColumn title="Ottavi" clubs={clubs.slice(0, 8)} />
        <BracketColumn title="Quarti" clubs={clubs.slice(0, 4)} locked />
        <BracketColumn title="Semifinali" clubs={clubs.slice(0, 2)} locked />
        <BracketColumn title="Finale" clubs={clubs.slice(0, 1)} locked />
      </div>
    </div>
  );
}

function BracketColumn({
  title,
  clubs,
  locked,
}: {
  title: string;
  clubs: StandingRow[];
  locked?: boolean;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
      <p className="mb-4 text-sm font-black uppercase tracking-[0.28em] text-lime-400">
        {title}
      </p>

      <div className="space-y-3">
        {clubs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">
            In attesa
          </div>
        ) : (
          clubs.map((club) => (
            <div
              key={`${title}-${club.id}`}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-white">
                    {club.club_name || "Club"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {locked ? "Da definire" : resultStatus(club)}
                  </p>
                </div>

                <div className="rounded-xl bg-lime-400 px-3 py-2 text-sm font-black text-black">
                  {locked ? "TBD" : scoreText(club)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ClubCell({ club }: { club: StandingRow }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white/10">
        {club.logo_url ? (
          <img
            src={club.logo_url}
            alt={club.club_name || "Club"}
            className="h-9 w-9 object-contain"
          />
        ) : null}
      </div>

      <div>
        <p className="text-base md:text-lg font-bold">{club.club_name}</p>
      </div>
    </div>
  );
}
