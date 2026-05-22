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

  if (!token) {
    console.warn("[DISCORD] Missing DISCORD_BOT_TOKEN/DISCORD_TOKEN on Vercel");
    return null;
  }

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error("[DISCORD] send message error", response.status, text);
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function sendDiscordDm(userId: string, body: any) {
  const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;

  if (!token || !userId) {
    console.warn("[DISCORD] Missing token or userId for DM");
    return null;
  }

  const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: userId }),
  });

  const dmText = await dmRes.text();

  if (!dmRes.ok) {
    console.error("[DISCORD] create DM error", dmRes.status, dmText);
    return null;
  }

  const dm = JSON.parse(dmText);
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
    // fallback per tabelle coppa senza submitted_by
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
