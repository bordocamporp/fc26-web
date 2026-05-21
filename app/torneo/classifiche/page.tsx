import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getStandings() {
  const { data } = await supabase
    .from("standings")
    .select("*")
    .order("points", { ascending: false });

  return data || [];
}

function groupCompetition(type: string) {
  const value = String(type || "").toLowerCase();

  if (
    value.includes("champions") ||
    value.includes("europa") ||
    value.includes("conference")
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
    <main className="min-h-screen bg-[#020403] text-white">
      <section className="border-b border-lime-400/20 bg-black/70 px-6 py-10 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-5">
            <Image
              src="/logo-bordo-campo.png"
              alt="BC"
              width={60}
              height={60}
            />

            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-lime-400">
                Torneo BC FC
              </p>

              <h1 className="mt-2 text-5xl font-black">
                CLASSIFICHE
              </h1>
            </div>
          </div>

          <a
            href="/torneo"
            className="rounded-2xl bg-lime-400 px-6 py-4 font-black text-black"
          >
            TORNA AL TORNEO
          </a>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-6 py-12">
        {Object.entries(grouped).map(([category, rows]) => (
          <section key={category}>
            <div className="mb-8">
              <p className="text-sm font-black uppercase tracking-[0.35em] text-lime-400">
                BC FC
              </p>

              <h2 className="mt-3 text-5xl font-black">
                {category}
              </h2>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-zinc-400">
                Nessuna classifica disponibile.
              </div>
            ) : (
              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur-xl">
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
                      <th className="px-4 py-5 text-center">DR</th>
                      <th className="px-6 py-5 text-center">PT</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((club: any, index: number) => {
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
                                  : "bg-white/5 text-white"
                              }`}
                            >
                              {index + 1}
                            </div>
                          </td>

                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-lime-400/20 bg-lime-400/10">
                                {club.logo_url ? (
                                  <img
                                    src={club.logo_url}
                                    alt={club.club_name}
                                    className="h-10 w-10 object-contain"
                                  />
                                ) : (
                                  <span className="font-black text-lime-400">
                                    FC
                                  </span>
                                )}
                              </div>

                              <div>
                                <p className="text-xl font-black">
                                  {club.club_name}
                                </p>

                                <p className="mt-1 text-xs text-zinc-500">
                                  {club.competition_name}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-5 text-center font-bold">
                            {club.played}
                          </td>

                          <td className="px-4 py-5 text-center font-bold text-lime-400">
                            {club.wins}
                          </td>

                          <td className="px-4 py-5 text-center font-bold">
                            {club.draws}
                          </td>

                          <td className="px-4 py-5 text-center font-bold text-red-400">
                            {club.losses}
                          </td>

                          <td className="px-4 py-5 text-center font-bold">
                            {club.goals_for}
                          </td>

                          <td className="px-4 py-5 text-center font-bold">
                            {club.goals_against}
                          </td>

                          <td className="px-4 py-5 text-center font-bold">
                            {diff > 0 ? "+" : ""}
                            {diff}
                          </td>

                          <td className="px-6 py-5 text-center">
                            <span className="rounded-2xl bg-lime-400 px-4 py-2 text-xl font-black text-black">
                              {club.points}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}