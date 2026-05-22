import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AnyMatch = Record<string, any>;

const ACTIVE_STATUSES = ["pending", "active", "scheduled"];

function clean(value: any) {
  return String(value || "").trim();
}

function isActiveMatch(match: AnyMatch) {
  const status = clean(match.status || "pending").toLowerCase();

  // Queste NON devono più uscire nella pagina risultati.
  if (
    status === "confirmed" ||
    status === "played" ||
    status === "awaiting_confirmation" ||
    status === "contested" ||
    status === "cancelled"
  ) {
    return false;
  }

  return ACTIVE_STATUSES.includes(status) || status === "";
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

async function getChampionshipMatches(userId: string) {
  const { data, error } = await supabase
    .from("championship_matches")
    .select(`
      *,
      championships(name)
    `)
    .or(`home_id.eq.${userId},away_id.eq.${userId}`)
    .order("round_number", { ascending: true });

  if (error) {
    console.error("[RISULTATI DATA] championship error", error);
    return [];
  }

  return (data || [])
    .filter(isActiveMatch)
    .map((match: AnyMatch) => ({
      id: match.id,
      source_table: "championship_matches",
      competition_name: match.championships?.name || "Campionato",
      competition_type: "Campionati",
      round: `Giornata ${match.round_number || "-"}`,
      leg: match.leg || match.phase || null,
      home_user_id: clean(match.home_id),
      away_user_id: clean(match.away_id),
      home_club: match.home_name || "Casa",
      away_club: match.away_name || "Trasferta",
    }));
}

async function getNationalCupMatches(userId: string) {
  const { data, error } = await supabase
    .from("national_cup_matches")
    .select(`
      *,
      national_cups(name)
    `)
    .or(`home_id.eq.${userId},away_id.eq.${userId}`)
    .order("round_number", { ascending: true });

  if (error) {
    console.error("[RISULTATI DATA] national cup error", error);
    return [];
  }

  return (data || [])
    .filter(isActiveMatch)
    .map((match: AnyMatch) => ({
      id: match.id,
      source_table: "national_cup_matches",
      competition_name: match.national_cups?.name || "Coppa Nazionale",
      competition_type: "Coppa Nazionale",
      round: `Turno ${match.round_number || "-"}`,
      leg: match.leg || match.phase || null,
      home_user_id: clean(match.home_id),
      away_user_id: clean(match.away_id),
      home_club: match.home_name || "Casa",
      away_club: match.away_name || "Trasferta",
    }));
}

async function getEuropeanCupMatches(userId: string) {
  const { data, error } = await supabase
    .from("european_cup_matches")
    .select(`
      *,
      european_cups(name)
    `)
    .or(`home_id.eq.${userId},away_id.eq.${userId}`)
    .order("round_number", { ascending: true });

  if (error) {
    // Se la tabella non esiste nel tuo DB, ignora.
    return [];
  }

  return (data || [])
    .filter(isActiveMatch)
    .map((match: AnyMatch) => ({
      id: match.id,
      source_table: "european_cup_matches",
      competition_name: match.european_cups?.name || "Coppa Europea",
      competition_type: "Coppa Europea",
      round: `Turno ${match.round_number || "-"}`,
      leg: match.leg || match.phase || null,
      home_user_id: clean(match.home_id),
      away_user_id: clean(match.away_id),
      home_club: match.home_name || "Casa",
      away_club: match.away_name || "Trasferta",
    }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = clean(searchParams.get("userId"));

    if (!userId) {
      return NextResponse.json({ error: "UserId mancante." }, { status: 400 });
    }

    const rawMatches = [
      ...(await getChampionshipMatches(userId)),
      ...(await getNationalCupMatches(userId)),
      ...(await getEuropeanCupMatches(userId)),
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

      // IMPORTANTISSIMO:
      // I giocatori vengono presi da owner_discord_id.
      // Quindi se un player è stato comprato apparirà nella nuova squadra.
      // Se è stato ceduto sparirà dalla vecchia squadra.
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
