import { createClient } from "@supabase/supabase-js";

export const RESULTS_CHANNEL_ID = "1504874612805337229";

export const MATCH_TABLES = new Set([
  "championship_matches",
  "national_cup_matches",
  "european_cup_matches",
  "cup_matches",
]);

export type ScorerPayload = {
  player_id: string;
  player_name: string;
  club_name: string;
  goals: number;
};

export function getSiteUrl() {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://bordocampobc.com")
  ).replace(/\/$/, "");
}

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function safeInt(value: any, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatScorers(scorers: ScorerPayload[] = []) {
  const valid = scorers.filter((item) => safeInt(item.goals) > 0);
  if (valid.length === 0) return "Nessun marcatore";
  return valid
    .map((item) => `• ${item.player_name} (${item.club_name}) x${safeInt(item.goals)}`)
    .join("\n");
}

export function buildResultText(payload: any) {
  const match = payload.match || {};
  const home = match.home_club || match.home_name || "Casa";
  const away = match.away_club || match.away_name || "Trasferta";
  return `${home} ${safeInt(payload.home_score)} - ${safeInt(payload.away_score)} ${away}`;
}

export async function sendDiscordMessage(channelId: string, body: any) {
  const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
  if (!token) return null;

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error("[DISCORD] send error", response.status, await response.text());
    return null;
  }

  return await response.json().catch(() => null);
}

export async function sendDiscordDm(userId: string, body: any) {
  const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
  if (!token || !userId) return null;

  const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: userId }),
  });

  if (!dmRes.ok) {
    console.error("[DISCORD] DM error", dmRes.status, await dmRes.text());
    return null;
  }

  const dm = await dmRes.json();
  return await sendDiscordMessage(dm.id, body);
}

export async function markSourceMatchAwaiting(table: string, id: string | number, payload: any) {
  const supabase = getSupabaseAdmin();

  if (!MATCH_TABLES.has(table)) {
    throw new Error("Tabella partita non valida.");
  }

  const { error } = await supabase
    .from(table)
    .update({
      home_goals: safeInt(payload.home_score),
      away_goals: safeInt(payload.away_score),
      status: "awaiting_confirmation",
      submitted_by: String(payload.userId || ""),
    })
    .eq("id", id);

  if (error) {
    const fallback = await supabase
      .from(table)
      .update({
        home_goals: safeInt(payload.home_score),
        away_goals: safeInt(payload.away_score),
        status: "awaiting_confirmation",
      })
      .eq("id", id);

    if (fallback.error) throw fallback.error;
  }
}

function getPoints(goalsFor: number, goalsAgainst: number) {
  if (goalsFor > goalsAgainst) return 3;
  if (goalsFor === goalsAgainst) return 1;
  return 0;
}

function getResultStats(goalsFor: number, goalsAgainst: number) {
  return {
    played: 1,
    wins: goalsFor > goalsAgainst ? 1 : 0,
    draws: goalsFor === goalsAgainst ? 1 : 0,
    losses: goalsFor < goalsAgainst ? 1 : 0,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    points: getPoints(goalsFor, goalsAgainst),
  };
}

async function addStandingRow(params: {
  competitionName: string;
  competitionType: string;
  clubName: string;
  goalsFor: number;
  goalsAgainst: number;
}) {
  const supabase = getSupabaseAdmin();

  const stats = getResultStats(params.goalsFor, params.goalsAgainst);

  const { data: existing } = await supabase
    .from("standings")
    .select("*")
    .eq("competition_name", params.competitionName)
    .eq("competition_type", params.competitionType)
    .eq("club_name", params.clubName)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("standings")
      .update({
        played: safeInt(existing.played) + stats.played,
        wins: safeInt(existing.wins) + stats.wins,
        draws: safeInt(existing.draws) + stats.draws,
        losses: safeInt(existing.losses) + stats.losses,
        goals_for: safeInt(existing.goals_for) + stats.goals_for,
        goals_against: safeInt(existing.goals_against) + stats.goals_against,
        points: safeInt(existing.points) + stats.points,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("standings").insert({
    competition_name: params.competitionName,
    competition_type: params.competitionType,
    club_name: params.clubName,
    logo_url: null,
    ...stats,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

async function updateStandingsFromResult(payload: any) {
  const match = payload.match || {};
  const competitionName = match.competition_name || "Competizione";
  const competitionType = match.competition_type || "Campionato";

  const homeClub = match.home_club || "Casa";
  const awayClub = match.away_club || "Trasferta";

  const homeScore = safeInt(payload.home_score);
  const awayScore = safeInt(payload.away_score);

  await addStandingRow({
    competitionName,
    competitionType,
    clubName: homeClub,
    goalsFor: homeScore,
    goalsAgainst: awayScore,
  });

  await addStandingRow({
    competitionName,
    competitionType,
    clubName: awayClub,
    goalsFor: awayScore,
    goalsAgainst: homeScore,
  });
}

export async function finalizeResultByPending(pending: any, mode: "accepted" | "auto_accepted") {
  const supabase = getSupabaseAdmin();
  const payload = pending.payload || {};
  const match = payload.match || {};
  const table = String(pending.source_table || match.source_table || "");
  const matchId = String(pending.source_match_id || match.id || "");

  if (!MATCH_TABLES.has(table)) {
    throw new Error("Tabella partita non valida.");
  }

  const homeScore = safeInt(payload.home_score);
  const awayScore = safeInt(payload.away_score);
  const winner =
    homeScore > awayScore
      ? match.home_club
      : awayScore > homeScore
        ? match.away_club
        : "Pareggio";

  const { error: updateError } = await supabase
    .from(table)
    .update({
      home_goals: homeScore,
      away_goals: awayScore,
      status: "confirmed",
      confirm_by: String(pending.opponent_id || ""),
    })
    .eq("id", matchId);

  if (updateError) {
    const fallback = await supabase
      .from(table)
      .update({
        home_goals: homeScore,
        away_goals: awayScore,
        status: "confirmed",
      })
      .eq("id", matchId);

    if (fallback.error) throw fallback.error;
  }

  await supabase.from("pending_result_confirmations").update({
    status: mode,
    responded_at: new Date().toISOString(),
  }).eq("id", pending.id);

  const alreadySaved = await supabase
    .from("match_results")
    .select("id")
    .eq("source_table", table)
    .eq("source_match_id", matchId)
    .maybeSingle();

  if (!alreadySaved.data) {
    await supabase.from("match_results").insert({
      source_table: table,
      source_match_id: matchId,
      competition_name: match.competition_name || "Competizione",
      competition_type: match.competition_type || "Campionato",
      round: match.round || null,
      home_team: match.home_club,
      away_team: match.away_club,
      home_score: homeScore,
      away_score: awayScore,
      winner,
      status: "played",
    });

    await updateStandingsFromResult(payload);
  }

  const scorers: ScorerPayload[] = payload.scorers || [];

  if (scorers.length > 0) {
    await supabase.from("match_scorers").insert(
      scorers.map((scorer) => ({
        match_id: Number(matchId),
        scorer_player_id: String(scorer.player_id || ""),
        scorer_name: scorer.player_name,
        team_owner_id:
          scorer.club_name === match.home_club
            ? String(match.home_user_id || "")
            : String(match.away_user_id || ""),
        goals: safeInt(scorer.goals, 1),
      }))
    );
  }

  const title = `${match.competition_name || "Competizione"} - ${match.home_club} vs ${match.away_club}`;
  const modeLabel = mode === "auto_accepted" ? "accettato automaticamente dopo 1 ora" : "confermato dall’avversario";

  await sendDiscordMessage(RESULTS_CHANNEL_ID, {
    embeds: [
      {
        title: "✅ RISULTATO UFFICIALE",
        description:
          `**${title}**\n\n` +
          `🏟️ **Risultato:** ${buildResultText(payload)}\n` +
          `📌 Stato: **${modeLabel}**\n\n` +
          `⚽ **Marcatori**\n${formatScorers(scorers)}`,
        color: 0x84cc16,
        footer: { text: "Bordo Campo FC26 • Risultati ufficiali" },
        timestamp: new Date().toISOString(),
      },
    ],
  });

  return true;
}
