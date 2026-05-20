import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "../auth/[...nextauth]/route";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { ok: false, message: "Devi accedere con Discord." },
      { status: 401 }
    );
  }

  // @ts-expect-error discordId custom
  const discordId = session.user.discordId as string | undefined;

  if (!discordId) {
    return NextResponse.json(
      { ok: false, message: "Discord ID non trovato nella sessione." },
      { status: 400 }
    );
  }

  const body = await request.json();

  const real_name = String(body.real_name || "").trim();
  const age = String(body.age || "").trim();
  const platform = String(body.platform || "").trim();
  const game_id = String(body.game_id || "").trim();
  const club_preferences = String(body.club_preferences || "").trim();

  if (!platform || !game_id) {
    return NextResponse.json(
      { ok: false, message: "Piattaforma e ID gioco sono obbligatori." },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("signup_requests")
    .select("id,status")
    .eq("discord_id", discordId)
    .in("status", ["pending", "accepted"])
    .limit(1);

  if (existing && existing.length > 0) {
    const status = existing[0].status;

    return NextResponse.json(
      {
        ok: false,
        message:
          status === "accepted"
            ? "Sei già iscritto al torneo."
            : "Hai già una richiesta in attesa.",
      },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("signup_requests").insert({
    discord_id: discordId,
    discord_name: session.user.name,
    real_name,
    age,
    platform,
    game_id,
    ea_id: game_id,
    preferred_clubs: club_preferences,
    club_preferences,
    status: "pending",
    signup_source: "website",
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Richiesta inviata correttamente. Lo staff la controllerà.",
  });
}
