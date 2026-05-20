import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      discord_id,
      discord_name,
      platform,
      age,
      psn_id,
      preferred_clubs,
    } = body;

    if (!discord_id || !discord_name) {
      return NextResponse.json(
        {
          ok: false,
          message: "Dati mancanti.",
        },
        { status: 400 }
      );
    }

    /*
      CONTROLLA MANAGER
    */

    const { data: existingManager } = await supabase
      .from("managers")
      .select("*")
      .eq("discord_id", discord_id)
      .maybeSingle();

    if (existingManager) {
      return NextResponse.json({
        ok: false,
        message: "Sei già iscritto al torneo.",
      });
    }

    /*
      CONTROLLA RICHIESTA PENDING
    */

    const { data: existingRequest } = await supabase
      .from("signup_requests")
      .select("*")
      .eq("discord_id", discord_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      return NextResponse.json({
        ok: false,
        message: "Hai già una richiesta in attesa.",
      });
    }

    /*
      SALVA RICHIESTA
    */

    const { data, error } = await supabase
      .from("signup_requests")
      .insert([
        {
          discord_id,
          discord_name,
          platform,
          age,
          psn_id,
          preferred_clubs,
          status: "pending",
          source: "website",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);

      return NextResponse.json(
        {
          ok: false,
          message: error.message,
        },
        { status: 500 }
      );
    }

    /*
      INVIO WEBHOOK DISCORD
    */

    try {
      if (process.env.DISCORD_WEBHOOK_URL) {
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            embeds: [
              {
                title: "📥 Nuova iscrizione torneo FC",
                color: 5763719,
                fields: [
                  {
                    name: "Discord",
                    value: discord_name || "N/D",
                    inline: true,
                  },
                  {
                    name: "Discord ID",
                    value: discord_id || "N/D",
                    inline: true,
                  },
                  {
                    name: "Piattaforma",
                    value: platform || "N/D",
                    inline: true,
                  },
                  {
                    name: "Età",
                    value: String(age || "N/D"),
                    inline: true,
                  },
                  {
                    name: "PSN / EA ID",
                    value: psn_id || "N/D",
                    inline: false,
                  },
                  {
                    name: "Club preferiti",
                    value: preferred_clubs || "N/D",
                    inline: false,
                  },
                ],
                footer: {
                  text: "Bordo Campo FC",
                },
              },
            ],
          }),
        });
      }
    } catch (err) {
      console.error("Webhook Discord error:", err);
    }

    return NextResponse.json({
      ok: true,
      request: data,
      message: "Richiesta inviata correttamente.",
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        ok: false,
        message: "Errore server.",
      },
      { status: 500 }
    );
  }
}