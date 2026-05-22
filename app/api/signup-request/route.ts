import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const STAFF_CHANNEL_ID = "1506320879015952535";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function siteUrl() {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://bordocampobc.com"
  ).replace(/\/$/, "");
}

async function sendDiscordMessage(channelId: string, body: any) {
  const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;

  if (!token) {
    console.warn("[SIGNUP] DISCORD_BOT_TOKEN mancante");
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
    console.error("[SIGNUP] Discord error", response.status, text);
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const discordId = String(body.discord_id || "").trim();
    const discordName = String(body.discord_name || "Unknown").trim();

    if (!discordId) {
      return NextResponse.json(
        { message: "Discord ID mancante. Effettua di nuovo il login Discord." },
        { status: 400 }
      );
    }

    const { data: existingAccepted } = await supabase
      .from("signup_requests")
      .select("*")
      .eq("discord_id", discordId)
      .eq("status", "accepted")
      .maybeSingle();

    if (existingAccepted) {
      return NextResponse.json(
        { message: "Sei già iscritto.", signup: existingAccepted },
        { status: 200 }
      );
    }

    const { data: existingPending } = await supabase
      .from("signup_requests")
      .select("*")
      .eq("discord_id", discordId)
      .eq("status", "pending")
      .maybeSingle();

    if (existingPending) {
      return NextResponse.json(
        { message: "Hai già una richiesta in attesa.", request: existingPending },
        { status: 200 }
      );
    }

    const { data: created, error } = await supabase
      .from("signup_requests")
      .insert({
        discord_id: discordId,
        discord_name: discordName,
        platform: body.platform || null,
        age: body.age || null,
        psn_id: body.psn_id || null,
        preferred_clubs: body.preferred_clubs || null,
        mode: body.mode || "fc26",
        status: "pending",
      })
      .select("*")
      .single();

    if (error) throw error;

    const acceptUrl = `${siteUrl()}/api/signup-accept/${created.id}`;
    const rejectUrl = `${siteUrl()}/api/signup-reject/${created.id}`;

    await sendDiscordMessage(STAFF_CHANNEL_ID, {
      embeds: [
        {
          title: "📝 Nuova richiesta iscrizione FC",
          description:
            `**Player:** ${discordName}\n` +
            `**Discord:** <@${discordId}>\n` +
            `**Discord ID:** ${discordId}\n\n` +
            `**Età:** ${body.age || "N/D"}\n` +
            `**Piattaforma:** ${body.platform || "N/D"}\n` +
            `**EA ID / PSN:** ${body.psn_id || "N/D"}\n` +
            `**Club preferiti:** ${body.preferred_clubs || "N/D"}\n\n` +
            `Lo staff può accettare assegnando un club oppure rifiutare la richiesta.`,
          color: 0x84cc16,
          footer: { text: `Richiesta ID ${created.id}` },
          timestamp: new Date().toISOString(),
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "✅ ACCETTA / ASSEGNA CLUB",
              url: acceptUrl,
            },
            {
              type: 2,
              style: 5,
              label: "❌ RIFIUTA",
              url: rejectUrl,
            },
          ],
        },
      ],
    });

    return NextResponse.json({
      message: "Richiesta inviata allo staff su Discord.",
      request: created,
    });
  } catch (error: any) {
    console.error("[SIGNUP REQUEST]", error);
    return NextResponse.json(
      { message: error?.message || "Errore durante l'invio della richiesta." },
      { status: 500 }
    );
  }
}
