import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function normalize(value: unknown) {
  return String(value || "").toLowerCase().trim();
}

function value(row: any, keys: string[], fallback = "") {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return fallback;
}

async function safeSelect(table: string) {
  const { data, error } = await supabase.from(table).select("*");

  if (error) {
    console.log(`[risultati-data] ${table}: ${error.message}`);
    return [];
  }

  return data || [];
}

async function getPlayersForClub(clubName: string, discordId?: string) {
  const players = await safeSelect("players");

  const club = normalize(clubName);
  const user = normalize(discordId);

  let rows = players.filter((player: any) => {
    const owner =
      normalize(player.owner_discord_id) ||
      normalize(player.discord_id) ||
      normalize(player.user_id) ||
      normalize(player.manager_id);

    const team =
      normalize(player.team) ||
      normalize(player.club_name) ||
      normalize(player.club) ||
      normalize(player.team_name);

    return (
      (user && owner === user) ||
      (club && team === club) ||
      (club && team.includes(club)) ||
      (club && club.includes(team))
    );
  });

  if (rows.length === 0) rows = players.slice(0, 25);

  return rows.slice(0, 25).map((player: any) => ({
    id: String(value(player, ["id", "player_id", "name"])),
    name: String(value(player, ["name", "player_name"], "Giocatore")),
    position: value(player, ["position", "role"], ""),
    overall: value(player, ["overall", "ovr", "rating"], ""),
    team: value(player, ["team", "club_name", "club", "team_name"], ""),
  }));
}

function isPending(row: any) {
  const status = normalize(row.status || "pending");
  const homeGoals = row.home_goals ?? row.home_score;
  const awayGoals = row.away_goals ?? row.away_score;

  return status !== "played" && homeGoals === null && awayGoals === null;
}

async function championshipNameFromGroup(groupId: any) {
  if (!groupId) return "Campionato";

  const { data: group } = await supabase
    .from("championship_groups")
    .select("*")
    .eq("id", groupId)
    .limit(1);

  const championshipId = group?.[0]?.championship_id;
  if (!championshipId) return "Campionato";

  const { data: championship } = await supabase
    .from("championships")
    .select("*")
    .eq("id", championshipId)
    .limit(1);

  return championship?.[0]?.name || "Campionato";
}

async function cupName(cupId: any, table: string, fallback: string) {
  if (!cupId) return fallback;

  const { data } = await supabase
    .from(table)
    .select("*")
    .eq("id", cupId)
    .limit(1);

  return data?.[0]?.name || fallback;
}

async function loadFixtures() {
  const rows = await safeSelect("fixtures");

  return rows
    .filter((row: any) => {
      const played = row.played === true || normalize(row.status) === "played";
      return !played;
    })
    .map((row: any) => ({
      id: String(row.id),
      source_table: "fixtures",
      competition_name: String(value(row, ["competition_name"], "Competizione")),
      competition_type: String(value(row, ["competition_type"], "Campionati")),
      round: String(value(row, ["round"], "")),
      leg: String(value(row, ["leg"], "")),
      home_user_id: String(value(row, ["home_user_id", "home_id"], "")),
      away_user_id: String(value(row, ["away_user_id", "away_id"], "")),
      home_club: String(value(row, ["home_club", "home_name"], "Casa")),
      away_club: String(value(row, ["away_club", "away_name"], "Trasferta")),
    }));
}

async function loadChampionshipMatches() {
  const rows = await safeSelect("championship_matches");
  const matches = [];

  for (const row of rows) {
    if (!isPending(row)) continue;

    matches.push({
      id: String(row.id),
      source_table: "championship_matches",
      competition_name: await championshipNameFromGroup(row.championship_group_id),
      competition_type: "Campionati",
      round: `Giornata ${row.round_number || ""}`,
      leg: String(value(row, ["leg"], "")),
      home_user_id: String(value(row, ["home_id", "home_user_id"], "")),
      away_user_id: String(value(row, ["away_id", "away_user_id"], "")),
      home_club: String(value(row, ["home_name", "home_club"], "Casa")),
      away_club: String(value(row, ["away_name", "away_club"], "Trasferta")),
    });
  }

  return matches;
}

async function loadNationalCupMatches() {
  const rows = await safeSelect("national_cup_matches");
  const matches = [];

  for (const row of rows) {
    if (!isPending(row)) continue;

    matches.push({
      id: String(row.id),
      source_table: "national_cup_matches",
      competition_name: await cupName(row.cup_id, "national_cups", "Coppa Nazionale"),
      competition_type: "Coppa Nazionale",
      round: `Turno ${row.round_number || ""}`,
      leg: String(value(row, ["leg"], "unica")),
      home_user_id: String(value(row, ["home_id", "home_user_id"], "")),
      away_user_id: String(value(row, ["away_id", "away_user_id"], "")),
      home_club: String(value(row, ["home_name", "home_club"], "Casa")),
      away_club: String(value(row, ["away_name", "away_club"], "Trasferta")),
    });
  }

  return matches;
}

async function loadEuropeanCupMatches() {
  const rows = await safeSelect("european_cup_matches");
  const matches = [];

  for (const row of rows) {
    if (!isPending(row)) continue;

    matches.push({
      id: String(row.id),
      source_table: "european_cup_matches",
      competition_name: await cupName(row.cup_id, "european_cups", "Coppa Europea"),
      competition_type: "Coppe Europee",
      round: `Turno ${row.round_number || ""}`,
      leg: String(value(row, ["leg"], "")),
      home_user_id: String(value(row, ["home_id", "home_user_id"], "")),
      away_user_id: String(value(row, ["away_id", "away_user_id"], "")),
      home_club: String(value(row, ["home_name", "home_club"], "Casa")),
      away_club: String(value(row, ["away_name", "away_club"], "Trasferta")),
    });
  }

  return matches;
}

export async function GET(request: NextRequest) {
  try {
    // Versione test: mostra TUTTE le partite pending, senza filtro utente.
    // Dopo il test possiamo riattivare il filtro "solo le mie partite".
    const rawMatches = [
      ...(await loadFixtures()),
      ...(await loadChampionshipMatches()),
      ...(await loadNationalCupMatches()),
      ...(await loadEuropeanCupMatches()),
    ];

    const seen = new Set<string>();
    const matches = [];

    for (const match of rawMatches) {
      const key = `${match.source_table}-${match.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      matches.push({
        ...match,
        home_players: await getPlayersForClub(match.home_club, match.home_user_id),
        away_players: await getPlayersForClub(match.away_club, match.away_user_id),
      });
    }

    return NextResponse.json({ matches });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Errore caricamento risultati." },
      { status: 500 }
    );
  }
}
