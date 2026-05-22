import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const STAFF_CHANNEL_ID = "1506320879015952535";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function clean(value: any) {
  return String(value || "").trim();
}

function esc(value: any) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

async function getAssignedClubNames() {
  const assigned = new Set<string>();

  const managers = await supabase
    .from("managers")
    .select("club_name")
    .not("club_name", "is", null);

  for (const row of managers.data || []) {
    if (row.club_name) assigned.add(clean(row.club_name).toLowerCase());
  }

  const accepted = await supabase
    .from("signup_requests")
    .select("club_name")
    .eq("status", "accepted")
    .not("club_name", "is", null);

  for (const row of accepted.data || []) {
    if (row.club_name) assigned.add(clean(row.club_name).toLowerCase());
  }

  return assigned;
}

async function getChampionshipMap() {
  const map = new Map<string, string>();

  const { data } = await supabase.from("championships").select("*");

  for (const champ of data || []) {
    const id = clean(champ.id);
    const name = clean(champ.name || champ.title || champ.competition_name || champ.league_name);
    if (id && name) map.set(id, name);
  }

  return map;
}

async function getFreeClubsGrouped() {
  const assigned = await getAssignedClubNames();
  const championshipMap = await getChampionshipMap();

  const { data: clubs, error } = await supabase
    .from("fc26_clubs")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("[SIGNUP ACCEPT] fc26_clubs error", error);
    return {};
  }

  const grouped: Record<string, any[]> = {};

  for (const club of clubs || []) {
    const clubName = clean(club.name || club.club_name || club.team_name);
    if (!clubName) continue;
    if (assigned.has(clubName.toLowerCase())) continue;

    const championshipName =
      clean(
        club.championship_name ||
        club.competition_name ||
        club.league_name ||
        club.championship ||
        club.league
      ) ||
      championshipMap.get(clean(club.championship_id)) ||
      championshipMap.get(clean(club.league_id)) ||
      "Club liberi";

    if (!grouped[championshipName]) grouped[championshipName] = [];
    grouped[championshipName].push({ ...club, display_name: clubName });
  }

  return grouped;
}

function renderAcceptPage(signup: any, grouped: Record<string, any[]>) {
  const hasClubs = Object.values(grouped).some((clubs) => clubs.length > 0);

  const optionsHtml = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([championshipName, clubs]) => {
      const options = clubs
        .sort((a, b) => clean(a.display_name).localeCompare(clean(b.display_name)))
        .map((club) => {
          const name = esc(club.display_name);
          return `<option value="${name}">${name}</option>`;
        })
        .join("");

      return `<optgroup label="${esc(championshipName)}">${options}</optgroup>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Accetta iscrizione</title>
  <style>
    body{margin:0;background:#020403;color:white;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}
    .card{max-width:780px;width:calc(100% - 32px);border:1px solid rgba(132,204,22,.35);border-radius:32px;background:#0b0f0b;padding:36px}
    h1{font-size:38px;margin:0 0 12px;font-weight:900}
    p{color:#cbd5e1;line-height:1.6}
    label{display:block;margin-top:22px;font-weight:900;color:#84cc16;text-transform:uppercase;letter-spacing:.18em;font-size:12px}
    select{width:100%;box-sizing:border-box;margin-top:10px;border:1px solid rgba(255,255,255,.15);background:#050705;color:white;border-radius:18px;padding:16px;font-size:18px;font-weight:800}
    select optgroup{background:#111;color:#84cc16;font-weight:900}
    select option{background:#050705;color:white}
    button{margin-top:24px;width:100%;border:0;background:#84cc16;color:#000;padding:18px;border-radius:18px;font-weight:900;font-size:16px;cursor:pointer}
    .hint{margin-top:10px;color:#94a3b8;font-size:14px}
    .empty{border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.10);padding:18px;border-radius:18px;color:#fecaca}
  </style>
</head>
<body>
  <form class="card" method="POST">
    <h1>Accetta iscrizione</h1>
    <p><b>Player:</b> ${esc(signup.discord_name || "Unknown")}<br/><b>Discord:</b> ${esc(signup.discord_id)}</p>
    <p><b>Piattaforma:</b> ${esc(signup.platform || "N/D")}<br/><b>EA ID:</b> ${esc(signup.psn_id || "N/D")}<br/><b>Preferenze:</b> ${esc(signup.preferred_clubs || "N/D")}</p>
    ${
      hasClubs
        ? `
          <label>Campionato e club libero da assegnare</label>
          <select name="club_name" required>
            <option value="">Seleziona un club libero...</option>
            ${optionsHtml}
          </select>
          <p class="hint">Vedi solo club non già assegnati a un manager.</p>
          <button type="submit">ACCETTA E ASSEGNA CLUB</button>
        `
        : `<div class="empty">Nessun club libero trovato. Controlla la tabella fc26_clubs o libera un club già assegnato.</div>`
    }
  </form>
</body>
</html>`;
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

  if (!signup) return html("Richiesta non trovata", "Questa richiesta non esiste.");
  if (signup.status === "accepted") return html("Già accettata", "Questa richiesta è già stata accettata.");

  const grouped = await getFreeClubsGrouped();

  return new Response(renderAcceptPage(signup, grouped), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const form = await request.formData();
  const clubName = clean(form.get("club_name"));

  if (!clubName) return html("Club mancante", "Devi selezionare il club da assegnare.");

  const { data: signup } = await supabase
    .from("signup_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!signup) return html("Richiesta non trovata", "Questa richiesta non esiste.");

  const assigned = await getAssignedClubNames();
  if (assigned.has(clubName.toLowerCase())) {
    return html("Club già assegnato", "Questo club è già stato assegnato. Torna indietro e scegline uno libero.");
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
    const updateWithStatus = await supabase
      .from("managers")
      .update({
        club_name: clubName,
        discord_name: signup.discord_name || existingManager.discord_name,
        status: "active",
      })
      .eq("discord_id", signup.discord_id);

    if (updateWithStatus.error) {
      await supabase
        .from("managers")
        .update({
          club_name: clubName,
          discord_name: signup.discord_name || existingManager.discord_name,
        })
        .eq("discord_id", signup.discord_id);
    }
  } else {
    const insertWithStatus = await supabase
      .from("managers")
      .insert({
        discord_id: signup.discord_id,
        discord_name: signup.discord_name || "Unknown",
        club_name: clubName,
        status: "active",
      });

    if (insertWithStatus.error) {
      await supabase
        .from("managers")
        .insert({
          discord_id: signup.discord_id,
          discord_name: signup.discord_name || "Unknown",
          club_name: clubName,
        });
    }
  }

  await supabase
    .from("players")
    .update({ owner_discord_id: signup.discord_id })
    .eq("team", clubName)
    .is("owner_discord_id", null);

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

  return html("Iscrizione accettata", `Club assegnato: ${esc(clubName)}. Il player ora accederà all’Area Manager.`);
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
