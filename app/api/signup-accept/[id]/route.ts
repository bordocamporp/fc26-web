import { NextResponse } from "next/server";
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

  if (!response.ok) {
    console.error("[SIGNUP ACCEPT] Discord error", response.status, await response.text());
    return null;
  }

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

  if (signup.status === "accepted") {
    return html("Già accettata", "Questa richiesta è già stata accettata.");
  }

  return new Response(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Accetta iscrizione</title>
  <style>
    body{margin:0;background:#020403;color:white;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}
    .card{max-width:680px;width:calc(100% - 32px);border:1px solid rgba(132,204,22,.35);border-radius:32px;background:#0b0f0b;padding:36px}
    h1{font-size:38px;margin:0 0 12px;font-weight:900}
    p{color:#cbd5e1;line-height:1.6}
    label{display:block;margin-top:22px;font-weight:900;color:#84cc16;text-transform:uppercase;letter-spacing:.18em;font-size:12px}
    input{width:100%;box-sizing:border-box;margin-top:10px;border:1px solid rgba(255,255,255,.15);background:#050705;color:white;border-radius:18px;padding:16px;font-size:18px;font-weight:800}
    button{margin-top:24px;width:100%;border:0;background:#84cc16;color:#000;padding:18px;border-radius:18px;font-weight:900;font-size:16px;cursor:pointer}
    a{color:#84cc16}
  </style>
</head>
<body>
  <form class="card" method="POST">
    <h1>Accetta iscrizione</h1>
    <p><b>Player:</b> ${signup.discord_name || "Unknown"}<br/><b>Discord:</b> ${signup.discord_id}</p>
    <p><b>Piattaforma:</b> ${signup.platform || "N/D"}<br/><b>EA ID:</b> ${signup.psn_id || "N/D"}<br/><b>Preferenze:</b> ${signup.preferred_clubs || "N/D"}</p>
    <label>Club da assegnare</label>
    <input name="club_name" placeholder="Esempio: Milan, Arsenal, Qarabağ FK..." required />
    <button type="submit">ACCETTA E ASSEGNA CLUB</button>
  </form>
</body>
</html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const form = await request.formData();
  const clubName = String(form.get("club_name") || "").trim();

  if (!clubName) {
    return html("Club mancante", "Devi inserire il club da assegnare.");
  }

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
      status: "accepted",
      club_name: clubName,
      handled_at: new Date().toISOString(),
    })
    .eq("id", id);

  const { data: existingManager } = await supabase
    .from("managers")
    .select("*")
    .eq("discord_id", signup.discord_id)
    .maybeSingle();

  if (existingManager) {
    await supabase
      .from("managers")
      .update({
        club_name: clubName,
        discord_name: signup.discord_name || existingManager.discord_name,
        status: "active",
      })
      .eq("discord_id", signup.discord_id);
  } else {
    await supabase
      .from("managers")
      .insert({
        discord_id: signup.discord_id,
        discord_name: signup.discord_name || "Unknown",
        club_name: clubName,
        status: "active",
      });
  }

  await sendDiscordMessage(STAFF_CHANNEL_ID, {
    embeds: [
      {
        title: "✅ Iscrizione accettata",
        description:
          `**Player:** ${signup.discord_name || "Unknown"}\n` +
          `**Discord:** <@${signup.discord_id}>\n` +
          `**Club assegnato:** ${clubName}\n\n` +
          `Da ora il player non vedrà più il form iscrizione e verrà mandato all’Area Manager.`,
        color: 0x84cc16,
        timestamp: new Date().toISOString(),
      },
    ],
  });

  return html("Iscrizione accettata", `Club assegnato: ${clubName}. Il player ora accederà all’Area Manager.`);
}

function html(title: string, text: string) {
  return new Response(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body{margin:0;background:#020403;color:white;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}
    .card{max-width:620px;border:1px solid rgba(132,204,22,.35);border-radius:32px;background:#0b0f0b;padding:40px;text-align:center}
    h1{font-size:42px;margin:0 0 16px;font-weight:900}
    p{color:#cbd5e1;font-size:18px;line-height:1.6}
    a{display:inline-block;margin-top:24px;background:#84cc16;color:#000;padding:16px 24px;border-radius:18px;font-weight:900;text-decoration:none}
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
