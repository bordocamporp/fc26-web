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
  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1800&q=85",
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

function stripHtml(value: string) {
  return decodeHtml(value)
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<font\b[^>]*>([\s\S]*?)<\/font>/gi, "$1")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRawTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] || "";
}

function extractTag(item: string, tag: string) {
  return stripHtml(extractRawTag(item, tag));
}

function shortTitle(title: string) {
  return String(title || "")
    .replace(/\s-\s[^-]{2,35}$/g, "")
    .replace(/\s\|\s[^|]{2,35}$/g, "")
    .trim();
}

function extractDescription(item: string) {
  const raw = decodeHtml(extractRawTag(item, "description"));

  const anchorTexts = Array.from(raw.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi))
    .map((m) => stripHtml(m[1]))
    .filter(Boolean);

  const text = stripHtml(raw);

  const withoutSourceLinks =
    anchorTexts.length > 0 ? text.replace(anchorTexts.join(" "), "").trim() : text;

  return withoutSourceLinks.length > 60
    ? withoutSourceLinks
    : "Apri la fonte per leggere l’articolo completo e tutti gli aggiornamenti.";
}

async function getFootballNews(): Promise<NewsItem[]> {
  try {
    const response = await fetch(GOOGLE_NEWS_RSS, {
      next: { revalidate: 300 },
      headers: { "User-Agent": "BordoCampoNews/1.0" },
    });

    const xml = await response.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

    return items.slice(0, 14).map((item) => ({
      title: shortTitle(extractTag(item, "title")),
      link: extractTag(item, "link"),
      source: extractTag(item, "source") || "Google News",
      pubDate: extractTag(item, "pubDate"),
      description: extractDescription(item),
    }));
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

  return table.slice(0, 8).map((row: any) => ({
    position: row.position,
    team: row.team?.shortName || row.team?.name || "N/D",
    points: row.points || 0,
  }));
}

async function getMatches(): Promise<MatchItem[]> {
  const data = await footballDataFetch("/matches");
  const matches = data?.matches || [];

  return matches.slice(0, 6).map((match: any) => {
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

function newsCategory(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("colpo") || lower.includes("mercato") || lower.includes("trasfer")) return "Mercato";
  if (lower.includes("champions")) return "Champions";
  if (lower.includes("mondiale") || lower.includes("world cup")) return "Mondiale";
  if (lower.includes("serie a")) return "Serie A";
  if (lower.includes("ufficiale")) return "Ufficiale";
  return "News";
}

function getTheme(news: NewsItem[]) {
  const text = news.map((item) => item.title).join(" ").toLowerCase();

  if (text.includes("mondiale") || text.includes("world cup")) {
    return { eyebrow: "Speciale mondiale", title: "Il calcio mondiale in tempo reale", icon: "🌍" };
  }

  if (text.includes("champions")) {
    return { eyebrow: "Champions focus", title: "Notizie, coppe e grandi match europei", icon: "🏆" };
  }

  if (text.includes("mercato") || text.includes("trasferimento") || text.includes("colpo")) {
    return { eyebrow: "Calciomercato live", title: "Colpi, trattative e aggiornamenti", icon: "💰" };
  }

  return { eyebrow: "Bordo Campo News", title: "Tutto il calcio, live e aggiornato", icon: "⚽" };
}

function formatDate(value: string) {
  if (!value) return "ora";

  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "ora";
  }
}

export default async function CalcioPage() {
  const [news, standings, matches] = await Promise.all([
    getFootballNews(),
    getStandings(),
    getMatches(),
  ]);

  const theme = getTheme(news);
  const mainNews = news[0];
  const secondaryNews = news.slice(1, 4);
  const listNews = news.slice(4);
  const hasFootballApi = Boolean(process.env.FOOTBALL_DATA_API_KEY);
  const heroImage = HERO_IMAGES[Math.floor(Date.now() / (1000 * 60 * 10)) % HERO_IMAGES.length];

  const tickerItems =
    news.length > 0
      ? news.slice(0, 10)
      : [
          { title: "Calcio live", link: "1" },
          { title: "Mercato", link: "2" },
          { title: "Risultati", link: "3" },
          { title: "Classifiche", link: "4" },
        ];

  return (
    <main className="min-h-screen bg-[#050705] text-white">
      <style>{`
        @keyframes bcMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes bcPulse {
          0%, 100% { box-shadow: 0 0 26px rgba(239,68,68,.45); transform: scale(1); }
          50% { box-shadow: 0 0 54px rgba(239,68,68,.75); transform: scale(1.035); }
        }
        .bc-marquee { animation: bcMarquee 45s linear infinite; }
        .bc-live { animation: bcPulse 1.5s ease-in-out infinite; }
      `}</style>

      <section className="relative overflow-hidden px-6 pb-12 pt-20 md:pb-20 md:pt-28">
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center opacity-50"
          style={{ backgroundImage: `url('${heroImage}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050705] via-black/20 to-black/50" />
        <div className="absolute left-[-200px] top-[-220px] h-[520px] w-[520px] rounded-full bg-lime-400/20 blur-[160px]" />
        <div className="absolute bottom-[-220px] right-[-180px] h-[520px] w-[520px] rounded-full bg-emerald-400/15 blur-[150px]" />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 xl:grid-cols-[1fr_520px] xl:items-end">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-lime-400/25 bg-black/45 px-5 py-3 backdrop-blur">
              <span className="text-2xl">{theme.icon}</span>
              <span className="text-xs font-black uppercase tracking-[0.3em] text-lime-300">
                {theme.eyebrow}
              </span>
            </div>

            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              {theme.title}
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300">
              News online, risultati e classifiche in un hub pulito, moderno e aggiornato automaticamente.
            </p>


            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-8 py-4 text-center text-lg font-black text-white backdrop-blur transition hover:scale-105 hover:border-lime-400 hover:bg-lime-400 hover:text-black"
              >
                ← TORNA ALLA HOME
              </a>

              <a
                href={DISCORD_LIVE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bc-live rounded-2xl bg-red-500 px-8 py-4 text-center text-lg font-black text-white transition hover:bg-red-400"
              >
                🔴 LIVE ENTRA
              </a>

              <a
                href="#news"
                className="rounded-2xl border border-lime-400/40 bg-lime-400/10 px-8 py-4 text-center font-black text-lime-200 backdrop-blur transition hover:bg-lime-400 hover:text-black"
              >
                LEGGI LE NEWS
              </a>
            </div>
          </div>

          {mainNews && (
            <a
              href={mainNews.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-[2.5rem] border border-lime-400/25 bg-black/70 p-7 backdrop-blur-xl transition hover:-translate-y-1 hover:border-lime-400/70 hover:shadow-[0_0_70px_rgba(132,204,22,0.20)]"
            >
              <div className="absolute right-[-90px] top-[-90px] h-[260px] w-[260px] rounded-full bg-lime-400/20 blur-[90px]" />
              <div className="relative z-10">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-lime-400 px-4 py-2 text-xs font-black text-black">
                    {newsCategory(mainNews.title)}
                  </span>
                  <span className="text-xs font-bold text-zinc-400">
                    {mainNews.source} • {formatDate(mainNews.pubDate)}
                  </span>
                </div>

                <h2 className="text-3xl font-black leading-tight">{mainNews.title}</h2>

                <p className="mt-4 line-clamp-4 leading-relaxed text-zinc-300">
                  {mainNews.description}
                </p>

                <div className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition group-hover:bg-lime-400">
                  APRI ARTICOLO
                </div>
              </div>
            </a>
          )}
        </div>
      </section>

      <section className="overflow-hidden border-y border-lime-400/20 bg-lime-400/10 py-4">
        <div className="bc-marquee flex w-max gap-14 whitespace-nowrap px-6 text-sm font-black uppercase tracking-[0.22em] text-lime-200">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item: any, index) => (
            <span key={`${item.link}-${index}`}>
              {newsCategory(item.title)} · {shortTitle(item.title)}
            </span>
          ))}
        </div>
      </section>

      <section id="news" className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-lime-400">
              Ultime dal web
            </p>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">Le notizie principali</h2>
          </div>
          <p className="text-sm text-zinc-500">Aggiornamento automatico ogni 5 minuti</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {secondaryNews.map((item) => (
            <a
              key={item.link}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 transition hover:-translate-y-1 hover:border-lime-400/50 hover:bg-white/[0.07]"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="rounded-full bg-lime-400/15 px-3 py-1 text-xs font-black text-lime-300">
                  {newsCategory(item.title)}
                </span>
                <span className="text-xs text-zinc-500">{formatDate(item.pubDate)}</span>
              </div>

              <h3 className="text-2xl font-black leading-tight">{item.title}</h3>
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-zinc-400">
                {item.description}
              </p>
              <span className="mt-5 inline-flex text-sm font-black text-lime-300 group-hover:text-lime-200">
                Leggi articolo →
              </span>
            </a>
          ))}
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_390px]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
            <div className="grid gap-3">
              {listNews.length === 0 && (
                <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-6 text-orange-100">
                  Nessuna news caricata al momento.
                </div>
              )}

              {listNews.map((item) => (
                <details
                  key={item.link}
                  className="group rounded-2xl border border-white/10 bg-black/45 transition hover:border-lime-400/40"
                >
                  <summary className="cursor-pointer list-none p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-lime-400 px-3 py-1 text-[11px] font-black text-black">
                            {newsCategory(item.title)}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {item.source} • {formatDate(item.pubDate)}
                          </span>
                        </div>
                        <h3 className="text-xl font-black leading-snug">{item.title}</h3>
                        <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
                          {item.description}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-lime-300 group-open:bg-lime-400 group-open:text-black">
                        APRI
                      </span>
                    </div>
                  </summary>

                  <div className="border-t border-white/10 p-5">
                    <p className="leading-relaxed text-zinc-300">{item.description}</p>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex rounded-xl bg-lime-400 px-5 py-3 text-sm font-black text-black"
                    >
                      LEGGI ARTICOLO COMPLETO
                    </a>
                  </div>
                </details>
              ))}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-lime-400">
                Classifica
              </p>
              <h2 className="mt-2 text-3xl font-black">Serie A</h2>

              {!hasFootballApi && (
                <div className="my-5 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm text-orange-100">
                  Aggiungi su Vercel: <b>FOOTBALL_DATA_API_KEY</b>
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
                      className="grid grid-cols-[32px_1fr_45px] items-center gap-3 rounded-xl bg-black/45 px-3 py-3"
                    >
                      <span className="font-black text-lime-400">{row.position}</span>
                      <span className="truncate font-bold">{row.team}</span>
                      <span className="text-right font-black">{row.points}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-lime-400">
                Risultati
              </p>
              <h2 className="mt-2 text-3xl font-black">Partite live</h2>

              <div className="mt-5 space-y-3">
                {matches.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-zinc-400">
                    Risultati non disponibili.
                  </div>
                ) : (
                  matches.map((match, index) => (
                    <div key={`${match.homeTeam}-${match.awayTeam}-${index}`} className="rounded-xl bg-black/45 p-4">
                      <div className="mb-2 flex justify-between text-xs text-zinc-500">
                        <span>{match.competition}</span>
                        <span>{match.status}</span>
                      </div>
                      <div className="grid grid-cols-[1fr_64px_1fr] items-center gap-2 text-sm font-black">
                        <span className="truncate">{match.homeTeam}</span>
                        <span className="rounded-lg bg-lime-400 px-2 py-2 text-center text-black">{match.score}</span>
                        <span className="truncate text-right">{match.awayTeam}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <a
              href={DISCORD_LIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bc-live flex rounded-[2rem] bg-red-500 p-6 text-center text-xl font-black text-white"
            >
              <span className="mx-auto">🔴 LIVE ENTRA NEL DISCORD</span>
            </a>
          </aside>
        </div>
      </section>
    </main>
  );
}
