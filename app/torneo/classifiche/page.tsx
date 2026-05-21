import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getStandings() {
  const { data, error } = await supabase
    .from("standings")
    .select("*")
    .order("points", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

function groupCompetition(type: string) {
  const value = String(type || "").toLowerCase().trim();

  if (value === "campionati") return "Campionati";
  if (value === "coppe europee") return "Coppe Europee";
  if (value === "coppa nazionale") return "Coppa Nazionale";

  if (
    value.includes("champions") ||
    value.includes("europa") ||
    value.includes("europe")
  ) {
    return "Coppe Europee";
  }

  if (
    value.includes("coppa") ||
    value.includes("nazionale")
  ) {
    return "Coppa Nazionale";
  }

  return "Campionati";
}

export default async function ClassifichePage() {
  const standings = await getStandings();

  const grouped = {
    Campionati: standings.filter(
      (x: any) => groupCompetition(x.competition_type) === "Campionati"
    ),

    "Coppe Europee": standings.filter(
      (x: any) => groupCompetition(x.competition_type) === "Coppe Europee"
    ),

    "Coppa Nazionale": standings.filter(
      (x: any) => groupCompetition(x.competition_type) === "Coppa Nazionale"
    ),
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-lime-500/20 px-6 py-14">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-5">
            <Image
              src="/bc-logo.png"
              alt="BC"
              width={70}
              height={70}
              className="object-contain"
            />

            <div>
              <p className="text-sm font-black uppercase tracking-[0.4em] text-lime-400">
                Torneo BC FC
              </p>

              <h1 className="mt-2 text-5xl font-black uppercase">
                Classifiche
              </h1>
            </div>
          </div>

          <Link
            href="/torneo"
            className="rounded-2xl bg-lime-400 px-8 py-5 text-lg font-black text-black transition hover:scale-105"
          >
            TORNA AL TORNEO
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-6 py-16">
        {Object.entries(grouped).map(([category, rows]) => (
          <section key={category}>
            <div className="mb-10">
              <p className="text-sm font-black uppercase tracking-[0.4em] text-lime-400">
                BC FC
              </p>

              <h2 className="mt-3 text-6xl font-black">
                {category}
              </h2>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-xl text-zinc-400">
                Nessuna classifica disponibile.
              </div>
            ) : (
              <div className="space-y-10">
                {Array.from(
                  new Set(rows.map((x: any) => x.competition_name))
                ).map((competition: any) => {
                  const clubs = rows.filter(
                    (x: any) => x.competition_name === competition
                  );

                  return (
                    <div
                      key={competition}
                      className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-xl"
                    >
                      <div className="border-b border-white/10 px-8 py-6">
                        <h3 className="text-3xl font-black">
                          {competition}
                        </h3>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-white/10 text-sm uppercase tracking-[0.2em] text-zinc-500">
                              <th className="px-6 py-5 text-left">#</th>
                              <th className="px-6 py-5 text-left">Club</th>
                              <th className="px-4 py-5 text-center">PG</th>
                              <th className="px-4 py-5 text-center">V</th>
                              <th className="px-4 py-5 text-center">N</th>
                              <th className="px-4 py-5 text-center">P</th>
                              <th className="px-4 py-5 text-center">GF</th>
                              <th className="px-4 py-5 text-center">GS</th>
                              <th className="px-6 py-5 text-center">PT</th>
                            </tr>
                          </thead>

                          <tbody>
                            {clubs.map((club: any, index: number) => {
                              const diff =
                                Number(club.goals_for || 0) -
                                Number(club.goals_against || 0);

                              return (
                                <tr
                                  key={club.id}
                                  className="border-b border-white/5 transition hover:bg-lime-400/5"
                                >
                                  <td className="px-6 py-5">
                                    <div
                                      className={`flex h-10 w-10 items-center justify-center rounded-xl font-black ${
                                        index === 0
                                          ? "bg-lime-400 text-black"
                                          : "bg-white/10"
                                      }`}
                                    >
                                      {index + 1}
                                    </div>
                                  </td>

                                  <td className="px-6 py-5">
                                    <div className="flex items-center gap-4">
                                      <div className="h-12 w-12 rounded-full bg-white/10" />

                                      <div>
                                        <p className="text-lg font-bold">
                                          {club.club_name}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-4 py-5 text-center">
                                    {club.played}
                                  </td>

                                  <td className="px-4 py-5 text-center text-lime-400">
                                    {club.wins}
                                  </td>

                                  <td className="px-4 py-5 text-center">
                                    {club.draws}
                                  </td>

                                  <td className="px-4 py-5 text-center text-red-400">
                                    {club.losses}
                                  </td>

                                  <td className="px-4 py-5 text-center">
                                    {club.goals_for}
                                  </td>

                                  <td className="px-4 py-5 text-center">
                                    {club.goals_against}
                                  </td>

                                  <td className="px-6 py-5 text-center">
                                    <div className="inline-flex rounded-xl bg-lime-400 px-4 py-2 font-black text-black">
                                      {club.points}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
