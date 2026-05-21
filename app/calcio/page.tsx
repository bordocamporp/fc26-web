type NewsItem = {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  description: string;
};

type StandingRow = {
  position: number;
  team: string;
  points: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
};

type MatchItem = {
  homeTeam: string;
  awayTeam: string;
  score: string;
  status: string;
  competition: string;
  date: string;
};

const DISCORD_LIVE_URL = "https://discord.gg/WJXXcGr2J3";

const GOOGLE_NEWS_RSS =
  "https://news.google.com/rss/search?q=calcio%20OR%20calciomercato%20OR%20Serie%20A%20OR%20Champions%20League%20when:1d&hl=it&gl=IT&ceid=IT:it";

const COMPETITIONS = [
  { code: "SA", name: "Serie A" },
  { code: "PL", name: "Premier League" },
  { code: "PD", name: "Liga" },
  { code: "BL1", name: "Bundesliga" },
  { code: "FL1", name: "Ligue 1" },
  { code: "CL", name: "Champions League" },
];

export const revalidate = 300;

function cleanText(value: string) {
  return String(value || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function extractTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return cleanText(match?.[1] || "");
}

async function getFootballNews(): Promise<NewsItem[]> {
  try {
    const response = await fetch(GOOGLE_NEWS_RSS, {
      next: { revalidate: 300 },
      headers: {
        "User-Agent": "BordoCampoNews/1.0",
      },
    });

    const xml = await response.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

    return items.slice(0, 12).map((item) => {
      const title = extractTag(item, "title");
      const link = extractTag(item, "link");
      const pubDate = extractTag(item, "pubDate");
      const description = extractTag(item, "description");
      const source = extractTag(item, "source") || "Google News";

      return {
        title,
        link,
        source,
        pubDate,
        description,
      };
    });
  } catch (error) {
    console.error("Errore caricamento news calcio:", error);
    return [];
  }
}

async function footballDataFetch(path: string) {
  const token = process.env.FOOTBALL_DATA_API_KEY;

  if (!token) return null;

  try {
    const response = await fetch(`https://api.football-data.org/v4${path}`, {
      next: { revalidate: 600 },
      headers: {
        "X-Auth-Token": token,
      },
    });

    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    console.error("Errore football-data:", error);
    return null;
  }
}

async function getStandings(competitionCode = "SA"): Promise<StandingRow[]> {
  const data = await footballDataFetch(`/competitions/${competitionCode}/standings`);

  const table = data?.standings?.[0]?.table || [];

  return table.slice(0, 12).map((row: any) => ({
    position: row.position,
    team: row.team?.shortName || row.team?.name || "N/D",
    points: row.points || 0,
    played: row.playedGames || 0,
    won: row.won || 0,
    draw: row.draw || 0,
    lost: row.lost || 0,
    goalsFor: row.goalsFor || 0,
    goalsAgainst: row.goalsAgainst || 0,
  }));
}

async function getMatches(): Promise<MatchItem[]> {
  const data = await footballDataFetch("/matches");

  const matches = data?.matches || [];

  return matches.slice(0, 10).map((match: any) => {
    const home = match.homeTeam?.shortName || match.homeTeam?.name || "Casa";
    const away = match.awayTeam?.shortName || match.awayTeam?.name || "Trasferta";
    const homeScore = match.score?.fullTime?.home;
    const awayScore = match.score?.fullTime?.away;

    return {
      homeTeam: home,
      awayTeam: away,
      score:
        homeScore !== null && awayScore !== null && homeScore !== undefined && awayScore !== undefined
          ? `${homeScore} - ${awayScore}`
          : "VS",
      status: match.status || "SCHEDULED",
      competition: match.competition?.name || "Calcio",
      date: match.utcDate || "",
    };
  });
}

function getTheme(news: NewsItem[]) {
  const text = news.map((item) => item.title).join(" ").toLowerCase();

  if (text.includes("mondiale") || text.includes("world cup")) {
    return {
      label: "Speciale Mondiale",
      title: "Il mondo del calcio è in modalità Mondiale",
      bg: "from-sky-500/25 via-emerald-500/15 to-black",
      icon: "🌍",
    };
  }

  if (text.includes("champions")) {
    return {
      label: "Notte Champions",
      title: "Champions League in primo piano",
      bg: "from-blue-600/25 via-indigo-500/15 to-black",
      icon: "🏆",
    };
  }

  if (text.includes("mercato") || text.includes("trasferimento") || text.includes("colpo")) {
    return {
      label: "Calciomercato Live",
      title: "Trattative, colpi e ultime notizie",
      bg: "from-lime-400/25 via-emerald-500/15 to-black",
      icon: "💰",
    };
  }

  return {
    label: "Football News",
    title: "News calcistiche live",
    bg: "from-lime-400/20 via-emerald-500/10 to-black",
    icon: "⚽",
  };
}

function formatDate(value: string) {
  if (!value) return "Aggiornato ora";

  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Aggiornato ora";
  }
}

function newsCategory(title: string) {
  const lower = title.toLowerCase();

  if (lower.includes("colpo") || lower.includes("mercato") || lower.includes("trasfer")) {
    return "COLPO DI MERCATO";
  }

  if (lower.includes("champions")) return "CHAMPIONS";
  if (lower.includes("mondiale") || lower.includes("world cup")) return "MONDIALE";
  if (lower.includes("serie a")) return "SERIE A";
  if (lower.includes("infortun")) return "INFORTUNIO";
  if (lower.includes("ufficiale")) return "UFFICIALE";

  return "NEWS";
}

export default async function CalcioPage() {
  const [news, standings, matches] = await Promise.all([
    getFootballNews(),
    getStandings("SA"),
    getMatches(),
  ]);

  const theme = getTheme(news);
  const hasFootballApi = Boolean(process.env.FOOTBALL_DATA_API_KEY);

  return (
    <main className="min-h-screen bg-[#030504] text-white">
      <section className={`relative overflow-hidden border-b border-lime-400/20 bg-gradient-to-br ${theme.bg} px-6 py-20`}>
        <div className="absolute left-[-160px] top-[-160px] h-[460px] w-[460px] rounded-full bg-lime-400/20 blur-[150px]" />
        <div className="absolute bottom-[-180px] right-[-140px] h-[460px] w-[460px] rounded-full bg-emerald-500/15 blur-[150px]" />

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center gap-4">
            <span className="rounded-2xl border border-lime-400/40 bg-black/40 px-5 py-3 text-3xl">
              {theme.icon}
            </span>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.4em] text-lime-400">
                {theme.label}
              </p>
              <h1 className="mt-3 max-w-5xl text-5xl font-black leading-none md:text-7xl">
                {theme.title}
              </h1>
            </div>
          </div>

          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-300">
            Notizie prese online, risultati, classifiche e aggiornamenti calcio.
            La pagina cambia atmosfera automaticamente in base alle notizie più importanti del momento.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <a
              href={DISCORD_LIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="animate-pulse rounded-2xl bg-red-500 px-8 py-4 text-center text-lg font-black text-white shadow-[0_0_35px_rgba(239,68,68,0.65)] transition hover:scale-105 hover:bg-red-400"
            >
              🔴 LIVE ENTRA
            </a>

            <a
              href="#news"
              className="rounded-2xl border border-lime-400/40 bg-lime-400/10 px-8 py-4 text-center font-black text-lime-300 transition hover:bg-lime-400 hover:text-black"
            >
              VEDI NEWS
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-lime-400/20 bg-lime-400/10 py-4">
        <div className="flex w-max animate-[marquee_28s_linear_infinite] gap-12 whitespace-nowrap px-6 text-sm font-black uppercase tracking-[0.25em] text-lime-300">
          {news.length > 0 ? (
            news.slice(0, 8).map((item) => (
              <span key={item.link}>
                {newsCategory(item.title)}: {item.title}
              </span>
            ))
          ) : (
            <>
              <span>NEWS CALCIO LIVE</span>
              <span>MERCATO</span>
              <span>RISULTATI</span>
              <span>CLASSIFICHE</span>
            </>
          )}
        </div>

        <style jsx>{`
          @keyframes marquee {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
        `}</style>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-12 xl:grid-cols-[1.35fr_0.9fr]">
        <div id="news" className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                Tendina news
              </p>
              <h2 className="mt-3 text-4xl font-black">Ultime dal web</h2>
            </div>

            <span className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-400">
              Aggiornamento automatico ogni 5 min
            </span>
          </div>

          <div className="space-y-4">
            {news.length === 0 && (
              <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-6 text-orange-100">
                Non riesco a caricare le news in questo momento. Riprova dopo il deploy o controlla la connessione server.
              </div>
            )}

            {news.map((item, index) => (
              <details
                key={`${item.link}-${index}`}
                className="group rounded-2xl border border-white/10 bg-black/45 p-5 transition hover:border-lime-400/40"
                open={index === 0}
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-lime-400 px-3 py-1 text-xs font-black text-black">
                          {newsCategory(item.title)}
                        </span>
                        <span className="text-xs font-bold text-zinc-500">
                          {item.source} • {formatDate(item.pubDate)}
                        </span>
                      </div>

                      <h3 className="text-2xl font-black leading-tight">
                        {item.title}
                      </h3>
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-lime-300">
                      APRI
                    </span>
                  </div>
                </summary>

                <div className="mt-5 border-t border-white/10 pt-5">
                  <p className="leading-relaxed text-zinc-300">
                    {item.description || "Apri la fonte per leggere la notizia completa."}
                  </p>

                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-black transition hover:scale-105"
                  >
                    LEGGI FONTE
                  </a>
                </div>
              </details>
            ))}
          </div>
        </div>

        <aside className="space-y-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                  Classifica
                </p>
                <h2 className="mt-3 text-3xl font-black">Serie A</h2>
              </div>
            </div>

            {!hasFootballApi && (
              <div className="mb-5 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm text-orange-100">
                Per classifiche reali aggiungi su Vercel la variabile:
                <br />
                <b>FOOTBALL_DATA_API_KEY</b>
              </div>
            )}

            <div className="space-y-2">
              {standings.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-zinc-400">
                  Classifica non disponibile.
                </div>
              ) : (
                standings.map((row) => (
                  <div
                    key={`${row.position}-${row.team}`}
                    className="grid grid-cols-[36px_1fr_48px] items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3"
                  >
                    <span className="font-black text-lime-400">{row.position}</span>
                    <span className="truncate font-bold">{row.team}</span>
                    <span className="text-right font-black">{row.points}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
              Risultati live
            </p>
            <h2 className="mt-3 text-3xl font-black">Partite</h2>

            <div className="mt-6 space-y-3">
              {matches.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-zinc-400">
                  Risultati non disponibili.
                </div>
              ) : (
                matches.map((match, index) => (
                  <div
                    key={`${match.homeTeam}-${match.awayTeam}-${index}`}
                    className="rounded-2xl border border-white/10 bg-black/40 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                      <span>{match.competition}</span>
                      <span>{match.status}</span>
                    </div>

                    <div className="grid grid-cols-[1fr_70px_1fr] items-center gap-3 text-sm font-black">
                      <span className="truncate">{match.homeTeam}</span>
                      <span className="rounded-xl bg-lime-400 px-3 py-2 text-center text-black">
                        {match.score}
                      </span>
                      <span className="truncate text-right">{match.awayTeam}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-red-400/30 bg-red-500/10 p-6">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-red-300">
              Diretta community
            </p>
            <h2 className="mt-3 text-3xl font-black">Guarda il live con noi</h2>
            <p className="mt-4 text-zinc-300">
              Entra nel server Discord Bordo Campo per commentare partite, mercato e tornei.
            </p>

            <a
              href={DISCORD_LIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full animate-pulse items-center justify-center rounded-2xl bg-red-500 px-6 py-4 text-center text-lg font-black text-white shadow-[0_0_35px_rgba(239,68,68,0.55)] transition hover:scale-105"
            >
              🔴 LIVE ENTRA
            </a>
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-[2rem] border border-lime-400/20 bg-lime-400/10 p-6">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
            Campionati supportati
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {COMPETITIONS.map((competition) => (
              <span
                key={competition.code}
                className="rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm font-black"
              >
                {competition.name}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
