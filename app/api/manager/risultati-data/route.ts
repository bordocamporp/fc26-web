import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Row = Record<string, any>;

function clean(value: any) {
  return String(value || "").trim();
}

function norm(value: any) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|fk|cf|sk|sc|ac|club)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hiddenStatus(statusValue: any) {
  const status = clean(statusValue || "pending").toLowerCase();

  return [
    "confirmed",
    "played",
    "awaiting_confirmation",
    "contested",
    "cancelled",
    "annullata",
    "confermata",
    "giocata",
  ].includes(status);
}

function normalizePlayer(player: Row) {
  return {
    id: player.id,
    name: player.name,
    position: player.position || null,
    overall: player.overall || null,
    team: player.team || null,
    image_url: player.image_url || player.card_url || player.photo_url || player.avatar_url || null,
    card_url: player.card_url || player.image_url || null,
    photo_url: player.photo_url || null,
    avatar_url: player.avatar_url || null,
    owner_discord_id: player.owner_discord_id || null,
  };
}

function sameTeam(playerTeam: any, clubName: any) {
  const a = norm(playerTeam);
  const b = norm(clubName);

  if (!a || !b) return false;

  return a === b || a.includes(b) || b.includes(a);
}

async function getPlayersByOwner(ownerDiscordId: string) {
  const owner = clean(ownerDiscordId);
  if (!owner) return [];

  // Uso select("*") perché alcuni DB non hanno card_url/photo_url/avatar_url.
  // Se una colonna non esiste e la selezioni, Supabase ritorna errore e non mostra i giocatori.
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("owner_discord_id", owner)
    .order("overall", { ascending: false });

  if (error) {
    console.error("[RISULTATI DATA] players owner error", owner, error);
    return [];
  }

  return (data || []).map(normalizePlayer);
}

async function getPlayersByClub(table: "players" | "players_fc26", clubName: string) {
  const club = clean(clubName);
  if (!club) return [];

  const candidates = Array.from(
    new Set([
      club,
      club.replace(/ğ/g, "g").replace(/Ğ/g, "G"),
      club.replace(/\bFK\b/gi, "").trim(),
      club.replace(/\bFC\b/gi, "").trim(),
      norm(club),
    ].filter(Boolean))
  );

  // Prima provo query leggere con ilike.
  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .ilike("team", `%${candidate}%`)
      .order("overall", { ascending: false })
      .limit(60);

    if (!error && data && data.length > 0) {
      return data.map(normalizePlayer);
    }
  }

  // Fallback definitivo: leggo a blocchi e confronto normalizzato in JS.
  // Serve per nomi con accenti o squadre scritte diversamente.
  let all: Row[] = [];
  const pageSize = 1000;

  for (let from = 0; from < 20000; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`[RISULTATI DATA] ${table} scan error`, error);
      break;
    }

    if (!data || data.length === 0) break;

    all = all.concat(data);

    if (data.length < pageSize) break;
  }

  return all
    .filter((player) => sameTeam(player.team, club))
    .sort((a, b) => Number(b.overall || 0) - Number(a.overall || 0))
    .slice(0, 60)
    .map(normalizePlayer);
}

async function getRoster(ownerDiscordId: string, clubName: string) {
  // Fonte corretta per mercato/scambi/aste:
  // se owner_discord_id è aggiornato, questa rosa contiene comprati e non contiene venduti.
  const byOwner = await getPlayersByOwner(ownerDiscordId);
  if (byOwner.length > 0) return byOwner;

  // Fallback solo se il DB non ha ancora owner_discord_id popolato.
  const byPlayersClub = await getPlayersByClub("players", clubName);
  if (byPlayersClub.length > 0) return byPlayersClub;

  const byFc26Club = await getPlayersByClub("players_fc26", clubName);
  if (byFc26Club.length > 0) return byFc26Club;

  return [];
}

function normalizeMatch(row: Row, sourceTable: string, competitionType: string) {
  const homeId =
    row.home_id ??
    row.home_user_id ??
    row.home_discord_id ??
    row.home_manager_id ??
    "";

  const awayId =
    row.away_id ??
    row.away_user_id ??
    row.away_discord_id ??
    row.away_manager_id ??
    "";

  const homeClub =
    row.home_name ??
    row.home_club ??
    row.home_team ??
    "Casa";

  const awayClub =
    row.away_name ??
    row.away_club ??
    row.away_team ??
    "Trasferta";

  return {
    id: row.id,
    source_table: sourceTable,
    competition_name: row.competition_name || row.name || competitionType,
    competition_type: competitionType,
    round: row.round || row.round_name || (row.round_number ? `Giornata ${row.round_number}` : "Turno"),
    leg: row.leg || row.phase || null,
    home_user_id: clean(homeId),
    away_user_id: clean(awayId),
    home_club: homeClub,
    away_club: awayClub,
  };
}

async function readTable(table: string, userId: string, competitionType: string) {
  const variants = [
    `home_id.eq.${userId},away_id.eq.${userId}`,
    `home_user_id.eq.${userId},away_user_id.eq.${userId}`,
    `home_discord_id.eq.${userId},away_discord_id.eq.${userId}`,
    `home_manager_id.eq.${userId},away_manager_id.eq.${userId}`,
  ];

  for (const orFilter of variants) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .or(orFilter)
      .order("id", { ascending: true });

    if (!error && data) {
      return data
        .filter((row: Row) => !hiddenStatus(row.status))
        .map((row: Row) => normalizeMatch(row, table, competitionType));
    }
  }

  return [];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = clean(searchParams.get("userId"));

    if (!userId) {
      return NextResponse.json({ error: "UserId mancante." }, { status: 400 });
    }

    const rawMatches = [
      ...(await readTable("championship_matches", userId, "Campionati")),
      ...(await readTable("national_cup_matches", userId, "Coppa Nazionale")),
      ...(await readTable("european_cup_matches", userId, "Coppa Europea")),
      ...(await readTable("cup_matches", userId, "Coppa")),
    ];

    const matches = await Promise.all(
      rawMatches.map(async (match) => ({
        ...match,
        home_players: await getRoster(match.home_user_id, match.home_club),
        away_players: await getRoster(match.away_user_id, match.away_club),
      }))
    );

    return NextResponse.json({ matches });
  } catch (error: any) {
    console.error("[RISULTATI DATA]", error);
    return NextResponse.json(
      { error: error?.message || "Errore caricamento risultati." },
      { status: 500 }
    );
  }
}
