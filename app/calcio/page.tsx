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
};

type MatchItem = {
  homeTeam: string;
  awayTeam: string;
  score: string;
  status: string;
  competition: string;
};

const DISCORD_LIVE_URL = "https://discord.gg/WJXXcGr2J3";

const GOOGLE_NEWS_RSS =
  "https://news.google.com/rss/search?q=calcio%20OR%20calciomercato%20OR%20Serie%20A%20OR%20Champions%20League%20when:1d&hl=it&gl=IT&ceid=IT:it";

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1800&q=80",
];

export const revalidate = 300;

function decodeHtml(value: string) {
  return String(value || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function cleanText(value: string) {
  return decodeHtml(value)
    .replace(/<a\b[^>]*>.*?<\/a>/gis, "")
    .replace(/<font\b[^>]*>.*?<\/font>/gis, "")
    .replace(/<img\b[^>]*>/gis, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return cleanText(match?.[1] || "");
}

function shortTitle(title: string) {
  return String(title || "")
    .replace(/\s-\s[^-]{2,35}$/g, "")
    .replace(/\s\|\s[^|]{2,35}$/g, "")
    .trim();
}

async function getFootballNews(): Promise<NewsItem[]> {
  try {
    const response = await fetch(GOOGLE_NEWS_RSS, {
      next: { revalidate: 300 },
      headers: { "User-Agent": "BordoCampoNews/1.0" },
    });

    const xml = await response.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

    return items.slice(0, 14).map((item) => {
      const rawTitle = extractTag(item, "title");
      const title = shortTitle(rawTitle);
      const description = cleanText(extractTag(item, "description"));

      return {
        title,
        link: extractTag(item, "link"),
        source: extractTag(item, "source") || "Google News",
        pubDate: extractTag(item, "pubDate"),
        description:
          description && description.length > 35
            ? description
            : "Apri la notizia completa per leggere tutti i dettagli aggiornati dalla fonte.",
      };
    });
  } catch {
    return [];
  }
}

async function footballDataFetch(path: string) {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) return null;

  try {
    const response = await fetch(`https://api.football-data.org/v4${path}`, {
      next: { revalidate: 600 },
      headers: { "X-Auth-Token": token },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function getStandings(): Promise<StandingRow[]> {
  const data = await footballDataFetch("/competitions/SA/standings");
  const table = data?.standings?.[0]?.table || [];

  return table.slice(0, 10).map((row: any) => ({
    position: row.position,
    team: row.team?.shortName || row.team?.name || "N/D",
    points: row.points || 0,
  }));
}

async function getMatches(): Promise<MatchItem[]> {
  const data = await footballDataFetch("/matches");
  const matches = data?.matches || [];

  return matches.slice(0, 8).map((match: any) => {
    const homeScore = match.score?.fullTime?.home;
    const awayScore = match.score?.fullTime?.away;

    return {
      homeTeam: match.homeTeam?.shortName || match.homeTeam?.name || "Casa",
      awayTeam: match.awayTeam?.shortName || match.awayTeam?.name || "Trasferta",
      score:
        homeScore !== null &&
        awayScore !== null &&
        homeScore !== undefined &&
        awayScore !== undefined
          ? `${homeScore} - ${awayScore}`
          : "VS",
      status: match.status || "SCHEDULED",
      competition: match.competition?.name || "Calcio",
    };
  });
}

function getTheme(news: NewsItem[]) {
  const text = news.map((item) => item.title).join(" ").toLowerCase();

  if (text.includes("mondiale") || text.includes("world cup")) {
    return {
      label: "Speciale Mondiale",
      title: "Il calcio mondiale, le notizie più calde",
      bg: "from-sky-500/35 via-emerald-400/15 to-black",
      icon: "🌍",
    };
  }

  if (text.includes("champions")) {
    return {
      label: "Champions Night",
      title: "Champions League e grandi serate europee",
      bg: "from-blue-700/35 via-indigo-500/15 to-black",
      icon: "🏆",
    };
  }

  if (text.includes("mercato") || text.includes("trasferimento") || text.includes("colpo")) {
    return {
      label: "Calciomercato Live",
      title: "Colpi, trattative e ultime di mercato",
      bg: "from-lime-400/30 via-emerald-500/15 to-black",
      icon: "💰",
    };
  }

  return {
    label: "Football News",
    title: "News calcistiche live",
    bg: "from-lime-400/25 via-emerald-500/10 to-black",
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

  if (lower.includes("colpo") || lower.includes("mercato") || lower.includes("trasfer")) return "COLPO DI MERCATO";
  if (lower.includes("champions")) return "CHAMPIONS";
  if (lower.includes("mondiale") || lower.includes("world cup")) return "MONDIALE";
  if (lower.includes("serie a")) return "SERIE A";
  if (lower.includes("ufficiale")) return "UFFICIALE";
  if (lower.includes("infortun")) return "INFORTUNIO";

  return "NEWS";
}

function categoryStyle(category: string) {
  if (category === "COLPO DI MERCATO") return "bg-yellow-300 text-black";
  if (category === "CHAMPIONS") return "bg-blue-400 text-black";
  if (category === "MONDIALE") return "bg-sky-300 text-black";
  if (category === "UFFICIALE") return "bg-red-500 text-white";
  return "bg-lime-400 text-black";
}

export default async function CalcioPage() {
  const [news, standings, matches] = await Promise.all([
    getFootballNews(),
    getStandings(),
    getMatches(),
  ]);

  const theme = getTheme(news);
  const mainNews = news[0];
  const hasFootballApi = Boolean(process.env.FOOTBALL_DATA_API_KEY);

  const heroIndex = Math.floor(Date.now() / (1000 * 60 * 10)) % HERO_IMAGES.length;
  const heroImage = HERO_IMAGES[heroIndex];

  const tickerItems =
    news.length > 0
      ? news.slice(0, 8)
      : [
          { title: "NEWS CALCIO LIVE", link: "1" },
          { title: "MERCATO", link: "2" },
          { title: "RISULTATI", link: "3" },
          { title: "CLASSIFICHE", link: "4" },
        ];

  return (
    <main className="min-h-screen bg-[#020403] text-white">
      <style>{`
        @keyframes bcMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        @keyframes bcFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-12px) scale(1.02); }
        }

        .bc-marquee {
          animation: bcMarquee 35s linear infinite;
        }

        .bc-float {
          animation: bcFloat 8s ease-in-out infinite;
        }
      `}</style>

      <section className={`relative min-h-[760px] overflow-hidden border-b border-lime-400/20 bg-gradient-to-br ${theme.bg} px-6 py-16 md:py-24`}>
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center opacity-55"
          style={{ backgroundImage: `url('${heroImage}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/65 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020403] via-transparent to-black/40" />

        <div className="absolute left-[-160px] top-[-160px] h-[520px] w-[520px] rounded-full bg-lime-400/25 blur-[160px]" />
        <div className="absolute bottom-[-200px] right-[-120px] h-[520px] w-[520px] rounded-full bg-emerald-500/20 blur-[160px]" />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 xl:grid-cols-[1fr_0.9fr] xl:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-lime-400/30 bg-black/55 px-5 py-3 backdrop-blur">
              <span className="text-3xl">{theme.icon}</span>
              <span className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                {theme.label}
              </span>
            </div>

            <h1 className="max-w-5xl text-5xl font-black leading-none drop-shadow-2xl md:text-7xl">
              {theme.title}
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-200">
              News calcistiche prese online, immagini dinamiche dal mondo del calcio,
              risultati, classifiche e aggiornamenti in tempo quasi reale.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href={DISCORD_LIVE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="animate-pulse rounded-2xl bg-red-500 px-8 py-4 text-center text-lg font-black text-white shadow-[0_0_45px_rgba(239,68,68,0.75)] transition hover:scale-105 hover:bg-red-400"
              >
                🔴 LIVE ENTRA
              </a>

              <a
                href="#news"
                className="rounded-2xl border border-lime-400/50 bg-black/45 px-8 py-4 text-center font-black text-lime-300 backdrop-blur transition hover:bg-lime-400 hover:text-black"
              >
                VEDI LE NEWS
              </a>
            </div>
          </div>

          {mainNews && (
            <a
              href={mainNews.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group bc-float relative overflow-hidden rounded-[2.5rem] border border-lime-400/30 bg-black/65 p-6 backdrop-blur-xl transition hover:border-lime-400 hover:shadow-[0_0_80px_rgba(132,204,22,0.28)]"
            >
              <div className="absolute right-[-100px] top-[-100px] h-[280px] w-[280px] rounded-full bg-lime-400/25 blur-[100px]" />

              <div className="relative z-10">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <span className={`rounded-full px-4 py-2 text-xs font-black ${categoryStyle(newsCategory(mainNews.title))}`}>
                    {newsCategory(mainNews.title)}
                  </span>

                  <span className="text-xs font-bold text-zinc-400">
                    {mainNews.source} • {formatDate(mainNews.pubDate)}
                  </span>
                </div>

                <h2 className="text-3xl font-black leading-tight md:text-5xl">
                  {mainNews.title}
                </h2>

                <p className="mt-5 line-clamp-5 text-lg leading-relaxed text-zinc-300">
                  {mainNews.description}
                </p>

                <div className="mt-8 inline-flex rounded-2xl bg-lime-400 px-6 py-4 font-black text-black transition group-hover:scale-105">
                  LEGGI ARTICOLO COMPLETO
                </div>
              </div>
            </a>
          )}
        </div>
      </section>

      <section className="overflow-hidden border-y border-lime-400/25 bg-black py-4">
        <div className="bc-marquee flex w-max gap-16 whitespace-nowrap px-6 text-sm font-black uppercase tracking-[0.25em] text-lime-300">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item: any, index) => (
            <span key={`${item.link}-${index}`}>
              {newsCategory(item.title)}: {shortTitle(item.title)}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-12 xl:grid-cols-[1.35fr_0.9fr]">
        <div id="news" className="rounded-[2.5rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
                News a tendina
              </p>
              <h2 className="mt-3 text-4xl font-black">Ultime notizie</h2>
            </div>

            <span className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-400">
              Aggiornamento ogni 5 min
            </span>
          </div>

          <div className="grid gap-4">
            {news.length === 0 && (
              <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-6 text-orange-100">
                Non riesco a caricare le news in questo momento.
              </div>
            )}

            {news.slice(1).map((item, index) => {
              const category = newsCategory(item.title);

              return (
                <details
                  key={`${item.link}-${index}`}
                  className="group overflow-hidden rounded-[2rem] border border-white/10 bg-black/45 transition hover:border-lime-400/40"
                >
                  <summary className="cursor-pointer list-none p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${categoryStyle(category)}`}>
                            {category}
                          </span>
                          <span className="text-xs font-bold text-zinc-500">
                            {item.source} • {formatDate(item.pubDate)}
                          </span>
                        </div>

                        <h3 className="text-2xl font-black leading-tight">
                          {item.title}
                        </h3>

                        <p className="mt-3 line-clamp-2 text-zinc-400">
                          {item.description}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-lime-300 transition group-open:bg-lime-400 group-open:text-black">
                        APRI
                      </span>
                    </div>
                  </summary>

                  <div className="border-t border-white/10 bg-black/35 p-5">
                    <p className="max-w-4xl text-lg leading-relaxed text-zinc-200">
                      {item.description}
                    </p>

                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 inline-flex rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black text-black transition hover:scale-105"
                    >
                      LEGGI ARTICOLO COMPLETO
                    </a>
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        <aside className="space-y-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
              Classifica
            </p>
            <h2 className="mt-3 text-3xl font-black">Serie A</h2>

            {!hasFootballApi && (
              <div className="my-5 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm text-orange-100">
                Per classifiche reali aggiungi su Vercel:
                <br />
                <b>FOOTBALL_DATA_API_KEY</b>
              </div>
            )}

            <div className="mt-5 space-y-2">
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

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
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

          <div className="rounded-[2rem] border border-red-400/30 bg-red-500/10 p-6 backdrop-blur-xl">
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
    </main>
  );
}
