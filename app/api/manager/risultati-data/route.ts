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

function isHiddenStatus(statusValue: any) {
  const status = clean(statusValue || "pending").toLowerCase();

  // Queste sono partite da NON mostrare nella pagina inserimento risultati.
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
        .filter((row: AnyRow) => !isHiddenStatus(row.status))
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

    // Versione più compatibile: legge le partite dalle tabelle usando più possibili nomi colonna.
    // Così non spariscono se il tuo database usa home_id/away_id oppure home_user_id/away_user_id.
    const rawMatches = [
      ...(await readTable("championship_matches", userId, "Campionati")),
      ...(await readTable("national_cup_matches", userId, "Coppa Nazionale")),
      ...(await readTable("european_cup_matches", userId, "Coppa Europea")),
      ...(await readTable("cup_matches", userId, "Coppa")),
    ];

    const ownerIds = Array.from(
      new Set(
        rawMatches
          .flatMap((match) => [match.home_user_id, match.away_user_id])
          .map(clean)
          .filter(Boolean)
      )
    );

    const playersByOwner: Record<string, any[]> = {};

    await Promise.all(
      ownerIds.map(async (ownerId) => {
        playersByOwner[ownerId] = await getPlayersByOwner(ownerId);
      })
    );

    const matches = rawMatches.map((match) => ({
      ...match,
      home_players: playersByOwner[match.home_user_id] || [],
      away_players: playersByOwner[match.away_user_id] || [],
    }));

    return NextResponse.json({ matches });
  } catch (error: any) {
    console.error("[RISULTATI DATA]", error);
    return NextResponse.json(
      { error: error?.message || "Errore caricamento risultati." },
      { status: 500 }
    );
  }
}
