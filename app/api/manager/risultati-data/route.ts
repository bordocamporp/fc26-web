import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AnyRow = Record<string, any>;

function clean(value: any) {
  return String(value || "").trim();
}

function norm(value: any) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/fk/g, "")
    .replace(/fc/g, "")
    .replace(/cf/g, "")
    .replace(/sk/g, "")
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

function playerSelect() {
  return `
    id,
    name,
    position,
    overall,
    team,
    image_url,
    card_url,
    photo_url,
    avatar_url,
    owner_discord_id
  `;
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

  const { data, error } = await supabase
    .from("players")
    .select(playerSelect())
    .eq("owner_discord_id", owner)
    .order("overall", { ascending: false });

  if (error) {
    console.error("[RISULTATI DATA] players owner error", owner, error);
    return [];
  }

  return data || [];
}

async function getPlayersByClubFromTable(table: "players" | "players_fc26", clubName: string) {
  const club = clean(clubName);
  if (!club) return [];

  // Non uso ILIKE perché nomi tipo Qarabağ / Qarabag, München / Munchen, ecc. non combaciano.
  // Prendo i giocatori e filtro normalizzando in JS.
  const { data, error } = await supabase
    .from(table)
    .select(playerSelect())
    .order("overall", { ascending: false })
    .limit(5000);

  if (error) {
    console.error(`[RISULTATI DATA] ${table} fallback error`, error);
    return [];
  }

  return (data || [])
    .filter((player: AnyRow) => sameTeam(player.team, club))
    .slice(0, 40);
}

async function getRoster(ownerDiscordId: string, clubName: string) {
  // 1. Priorità assoluta: rosa aggiornata da mercato/scambi/aste.
  const byOwner = await getPlayersByOwner(ownerDiscordId);
  if (byOwner.length > 0) return byOwner;

  // 2. Fallback: nome club nella tabella players.
  const byClubPlayers = await getPlayersByClubFromTable("players", clubName);
  if (byClubPlayers.length > 0) return byClubPlayers;

  // 3. Fallback finale: dataset players_fc26 se esiste.
  const byClubFc26 = await getPlayersByClubFromTable("players_fc26", clubName);
  if (byClubFc26.length > 0) return byClubFc26;

  return [];
}

function normalizeMatch(row: AnyRow, sourceTable: string, competitionName: string, competitionType: string) {
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
    competition_name: competitionName,
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
        .filter((row: AnyRow) => !hiddenStatus(row.status))
        .map((row: AnyRow) =>
          normalizeMatch(
            row,
            table,
            row.competition_name || row.name || competitionType,
            competitionType
          )
        );
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
