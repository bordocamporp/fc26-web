import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

function v(row: any, keys: string[], fallback = "") {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return fallback;
}

function isPending(row: any) {
  const status = String(row.status || "pending").toLowerCase();
  const homeGoals = row.home_goals ?? row.home_score;
  const awayGoals = row.away_goals ?? row.away_score;

  return status !== "played" && homeGoals === null && awayGoals === null;
}

async function safeRows(table: string) {
  const { data, error } = await supabase.from(table).select("*");

  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: data || [], error: null };
}

async function playersForClub(clubName: string) {
  const { rows } = await safeRows("players");

  const club = String(clubName || "").toLowerCase().trim();

  let filtered = rows.filter((p: any) => {
    const team = String(
      p.team || p.club_name || p.club || p.team_name || ""
    )
      .toLowerCase()
      .trim();

    return team === club || team.includes(club) || club.includes(team);
  });

  if (!filtered.length) filtered = rows.slice(0, 25);

  return filtered.slice(0, 25).map((p: any) => ({
    id: String(v(p, ["id", "player_id", "name"])),
    name: String(v(p, ["name", "player_name"], "Giocatore")),
    position: v(p, ["position", "role"], ""),
    overall: v(p, ["overall", "ovr", "rating"], ""),
    team: v(p, ["team", "club_name", "club", "team_name"], ""),
  }));
}

export async function GET() {
  try {
    const championship = await safeRows("championship_matches");
    const nationalCup = await safeRows("national_cup_matches");
    const fixtures = await safeRows("fixtures");
    const cupMatches = await safeRows("cup_matches");

    const rawMatches: any[] = [];

    for (const row of championship.rows) {
      if (!isPending(row)) continue;

      rawMatches.push({
        id: String(row.id),
        source_table: "championship_matches",
        competition_name: "Campionato",
        competition_type: "Campionati",
        round: `Giornata ${row.round_number || ""}`,
        leg: String(v(row, ["leg"], "")),
        home_user_id: String(v(row, ["home_id", "home_user_id"], "")),
        away_user_id: String(v(row, ["away_id", "away_user_id"], "")),
        home_club: String(v(row, ["home_name", "home_club"], "Casa")),
        away_club: String(v(row, ["away_name", "away_club"], "Trasferta")),
      });
    }

    for (const row of nationalCup.rows) {
      if (!isPending(row)) continue;

      rawMatches.push({
        id: String(row.id),
        source_table: "national_cup_matches",
        competition_name: "Coppa Nazionale",
        competition_type: "Coppa Nazionale",
        round: `Turno ${row.round_number || ""}`,
        leg: String(v(row, ["leg"], "unica")),
        home_user_id: String(v(row, ["home_id", "home_user_id"], "")),
        away_user_id: String(v(row, ["away_id", "away_user_id"], "")),
        home_club: String(v(row, ["home_name", "home_club"], "Casa")),
        away_club: String(v(row, ["away_name", "away_club"], "Trasferta")),
      });
    }

    for (const row of fixtures.rows) {
      const played = row.played === true || String(row.status || "").toLowerCase() === "played";
      if (played) continue;

      rawMatches.push({
        id: String(row.id),
        source_table: "fixtures",
        competition_name: String(v(row, ["competition_name"], "Competizione")),
        competition_type: String(v(row, ["competition_type"], "Campionati")),
        round: String(v(row, ["round"], "")),
        leg: String(v(row, ["leg"], "")),
        home_user_id: String(v(row, ["home_user_id", "home_id"], "")),
        away_user_id: String(v(row, ["away_user_id", "away_id"], "")),
        home_club: String(v(row, ["home_club", "home_name"], "Casa")),
        away_club: String(v(row, ["away_club", "away_name"], "Trasferta")),
      });
    }

    for (const row of cupMatches.rows) {
      if (!isPending(row)) continue;

      rawMatches.push({
        id: String(row.id),
        source_table: "cup_matches",
        competition_name: String(v(row, ["competition_name"], "Coppa")),
        competition_type: "Coppe Europee",
        round: String(v(row, ["round"], `Turno ${row.round_number || ""}`)),
        leg: String(v(row, ["leg"], "")),
        home_user_id: String(v(row, ["home_id", "home_user_id"], "")),
        away_user_id: String(v(row, ["away_id", "away_user_id"], "")),
        home_club: String(v(row, ["home_name", "home_club", "home_team"], "Casa")),
        away_club: String(v(row, ["away_name", "away_club", "away_team"], "Trasferta")),
      });
    }

    const matches = [];

    for (const match of rawMatches) {
      matches.push({
        ...match,
        home_players: await playersForClub(match.home_club),
        away_players: await playersForClub(match.away_club),
      });
    }

    return NextResponse.json({
      debug: {
        usingServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        championship_matches: championship.rows.length,
        championship_error: championship.error,
        national_cup_matches: nationalCup.rows.length,
        national_cup_error: nationalCup.error,
        fixtures: fixtures.rows.length,
        fixtures_error: fixtures.error,
        cup_matches: cupMatches.rows.length,
        cup_matches_error: cupMatches.error,
        returned_matches: matches.length,
      },
      matches,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Errore API risultati-data",
        matches: [],
      },
      { status: 500 }
    );
  }
}
