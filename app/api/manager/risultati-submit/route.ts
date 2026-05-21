import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.json();

  const match = body.match;
  const userId = String(body.userId || "");
  const homeScore = Number(body.home_score || 0);
  const awayScore = Number(body.away_score || 0);
  const scorers = Array.isArray(body.scorers) ? body.scorers : [];

  if (!match?.id || !match?.source_table) {
    return NextResponse.json({ error: "Partita non valida." }, { status: 400 });
  }

  if (homeScore === 0 && awayScore === 0) {
    return NextResponse.json(
      { error: "Inserisci almeno un marcatore." },
      { status: 400 }
    );
  }

  const opponentDiscordId =
    String(match.home_user_id || "") === userId
      ? String(match.away_user_id || "")
      : String(match.home_user_id || "");

  const { data: pending, error } = await supabase
    .from("pending_match_results")
    .insert({
      source_table: match.source_table,
      source_match_id: String(match.id),
      competition_name: match.competition_name,
      competition_type: match.competition_type,
      round: match.round,
      leg: match.leg,
      submitted_by: userId,
      opponent_discord_id: opponentDiscordId,
      home_team: match.home_club,
      away_team: match.away_club,
      home_score: homeScore,
      away_score: awayScore,
      status: "pending_confirmation",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (scorers.length) {
    const scorerRows = scorers.map((scorer: any) => ({
      pending_result_id: pending.id,
      player_id: String(scorer.player_id || ""),
      player_name: String(scorer.player_name || ""),
      club_name: String(scorer.club_name || ""),
      goals: Number(scorer.goals || 1),
    }));

    const { error: scorerError } = await supabase
      .from("pending_result_scorers")
      .insert(scorerRows);

    if (scorerError) {
      return NextResponse.json({ error: scorerError.message }, { status: 500 });
    }
  }

  /*
    Prossimo step bot:
    Il bot può controllare pending_match_results con status='pending_confirmation'
    e mandare DM all'opponent_discord_id con Conferma/Contesta.
  */

  return NextResponse.json({ ok: true, pending_result_id: pending.id });
}
