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

function getField(row: any, names: string[], fallback = "") {
  for (const name of names) {
    if (row?.[name] !== undefined && row?.[name] !== null) return row[name];
  }
  return fallback;
}

async function getClubForUser(userId: string) {
  if (!userId) return "";

  const tables = [
    { table: "managers", user: "discord_id", club: "club_name" },
    { table: "real_team_assignments", user: "discord_id", club: "team_name" },
    { table: "signups", user: "discord_id", club: "club_name" },
  ];

  for (const item of tables) {
    const { data } = await supabase
      .from(item.table)
      .select("*")
      .eq(item.user, userId)
      .limit(1);

    if (data?.[0]?.[item.club]) return String(data[0][item.club]);
  }

  return "";
}

async function getPlayersForClub(clubName: string, userId?: string) {
  const { data, error } = await supabase.from("players").select("*");

  if (error || !data) return [];

  const club = normalize(clubName);

  let rows = data.filter((player: any) => {
    const owner =
      normalize(player.owner_discord_id) ||
      normalize(player.discord_id) ||
      normalize(player.user_id);

    const team =
      normalize(player.team) ||
      normalize(player.club_name) ||
      normalize(player.club);

    return (
      (userId && owner === normalize(userId)) ||
      team === club ||
      team.includes(club) ||
      club.includes(team)
    );
  });

  if (rows.length === 0) {
    rows = data.slice(0, 25);
  }

  return rows.slice(0, 25).map((player: any) => ({
    id: getField(player, ["id", "player_id", "name"]),
    name: String(getField(player, ["name", "player_name"], "Giocatore")),
    position: getField(player, ["position", "role"], ""),
    overall: getField(player, ["overall", "ovr", "rating"], ""),
    team: getField(player, ["team", "club_name", "club"], ""),
  }));
}

function normalizeFixture(row: any) {
  return {
    id: row.id,
    source_table: "fixtures",
    competition_name: row.competition_name || "Competizione",
    competition_type: row.competition_type || "Campionati",
    round: row.round || "",
    leg: row.leg || "",
    home_user_id: row.home_user_id || "",
    away_user_id: row.away_user_id || "",
    home_club: row.home_club || row.home_name || "Casa",
    away_club: row.away_club || row.away_name || "Trasferta",
  };
}

async function loadFixtures(userId: string, clubName: string) {
  const { data } = await supabase
    .from("fixtures")
    .select("*")
    .eq("played", false)
    .order("id", { ascending: true });

  const rows = data || [];

  return rows
    .map(normalizeFixture)
    .filter((match: any) => {
      if (!userId && !clubName) return true;

      return (
        normalize(match.home_user_id) === normalize(userId) ||
        normalize(match.away_user_id) === normalize(userId) ||
        normalize(match.home_club) === normalize(clubName) ||
        normalize(match.away_club) === normalize(clubName)
      );
    });
}

async function loadOldChampionshipMatches(userId: string, clubName: string) {
  const { data } = await supabase.from("championship_matches").select("*");

  const rows = data || [];

  return rows
    .filter((row: any) => normalize(row.status || "pending") !== "played")
    .map((row: any) => ({
      id: row.id,
      source_table: "championship_matches",
      competition_name: row.competition_name || "Campionato",
      competition_type: "Campionati",
      round: row.round || `Giornata ${row.round_number || ""}`,
      leg: row.leg || "",
      home_user_id: row.home_id || row.home_user_id || "",
      away_user_id: row.away_id || row.away_user_id || "",
      home_club: row.home_name || row.home_club || "Casa",
      away_club: row.away_name || row.away_club || "Trasferta",
    }))
    .filter((match: any) => {
      if (!userId && !clubName) return true;

      return (
        normalize(match.home_user_id) === normalize(userId) ||
        normalize(match.away_user_id) === normalize(userId) ||
        normalize(match.home_club) === normalize(clubName) ||
        normalize(match.away_club) === normalize(clubName)
      );
    });
}

async function loadOldNationalCupMatches(userId: string, clubName: string) {
  const { data } = await supabase.from("national_cup_matches").select("*");

  const rows = data || [];

  return rows
    .filter((row: any) => normalize(row.status || "pending") !== "played")
    .map((row: any) => ({
      id: row.id,
      source_table: "national_cup_matches",
      competition_name: row.competition_name || "Coppa Nazionale",
      competition_type: "Coppa Nazionale",
      round: row.round || `Turno ${row.round_number || ""}`,
      leg: "unica",
      home_user_id: row.home_id || row.home_user_id || "",
      away_user_id: row.away_id || row.away_user_id || "",
      home_club: row.home_name || row.home_club || "Casa",
      away_club: row.away_name || row.away_club || "Trasferta",
    }))
    .filter((match: any) => {
      if (!userId && !clubName) return true;

      return (
        normalize(match.home_user_id) === normalize(userId) ||
        normalize(match.away_user_id) === normalize(userId) ||
        normalize(match.home_club) === normalize(clubName) ||
        normalize(match.away_club) === normalize(clubName)
      );
    });
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId") || "";
  const clubName = await getClubForUser(userId);

  const allMatches = [
    ...(await loadFixtures(userId, clubName)),
    ...(await loadOldChampionshipMatches(userId, clubName)),
    ...(await loadOldNationalCupMatches(userId, clubName)),
  ];

  const seen = new Set<string>();
  const matches = [];

  for (const match of allMatches) {
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
}
