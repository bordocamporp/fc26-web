import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const STAFF_CHANNEL_ID = "1506320879015952535";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function sendDiscordMessage(channelId: string, body: any) {
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

  if (!response.ok) return null;
  return await response.json().catch(() => null);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: signup } = await supabase
    .from("signup_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!signup) {
    return html("Richiesta non trovata", "Questa richiesta non esiste.");
  }

  await supabase
    .from("signup_requests")
    .update({
      status: "rejected",
      handled_at: new Date().toISOString(),
    })
    .eq("id", id);

  await sendDiscordMessage(STAFF_CHANNEL_ID, {
    embeds: [
      {
        title: "❌ Iscrizione rifiutata",
        description:
          `**Player:** ${signup.discord_name || "Unknown"}\n` +
          `**Discord:** <@${signup.discord_id}>\n` +
          `La richiesta è stata rifiutata dallo staff.`,
        color: 0xef4444,
        timestamp: new Date().toISOString(),
      },
    ],
  });

  return html("Richiesta rifiutata", "La richiesta è stata rifiutata.");
}

function html(title: string, text: string) {
  return new Response(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body{margin:0;background:#020403;color:white;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}
    .card{max-width:620px;border:1px solid rgba(239,68,68,.35);border-radius:32px;background:#0b0f0b;padding:40px;text-align:center}
    h1{font-size:42px;margin:0 0 16px;font-weight:900}
    p{color:#cbd5e1;font-size:18px;line-height:1.6}
    a{display:inline-block;margin-top:24px;background:#ef4444;color:#fff;padding:16px 24px;border-radius:18px;font-weight:900;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${text}</p>
    <a href="/">Torna al sito</a>
  </div>
</body>
</html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
