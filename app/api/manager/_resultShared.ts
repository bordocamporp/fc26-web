import { createClient } from "@supabase/supabase-js";

export const RESULTS_CHANNEL_ID = "1504874612805337229";

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function getSiteUrl() {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://bordocampobc.com"
  ).replace(/\/$/, "");
}

export function safeInt(value: any, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatScorers(scorers: any[] = []) {
  const valid = scorers.filter((item) => safeInt(item.goals) > 0);
  if (valid.length === 0) return "Nessun marcatore";

  return valid
    .map((item) => `• ${item.player_name} (${item.club_name}) x${safeInt(item.goals)}`)
    .join("\n");
}

export function buildResultText(payload: any) {
  const match = payload.match || {};
  return `${match.home_club} ${safeInt(payload.home_score)} - ${safeInt(payload.away_score)} ${match.away_club}`;
}

export async function discordFetch(path: string, options: RequestInit = {}) {
  const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;

  if (!token) {
    console.warn("[DISCORD] Token mancante");
    return null;
  }

  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  if (!response.ok) {
    console.error("[DISCORD ERROR]", response.status, text);
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function sendDiscordMessage(channelId: string, body: any) {
  return await discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function sendDiscordDm(userId: string, body: any) {
  const dm = await discordFetch("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: userId }),
  });

  if (!dm?.id) return null;

  const message = await sendDiscordMessage(dm.id, body);

  return {
    dm_channel_id: dm.id,
    dm_message_id: message?.id || null,
  };
}

export async function closeDiscordDmMessage(pending: any, title: string, description: string, color: number) {
  const channelId = pending.dm_channel_id;
  const messageId = pending.dm_message_id;

  if (!channelId || !messageId) return null;

  return await discordFetch(`/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      embeds: [
        {
          title,
          description,
          color,
          footer: { text: "Bordo Campo FC26 • Conferma risultato chiusa" },
          timestamp: new Date().toISOString(),
        },
      ],
      components: [],
    }),
  });
}
