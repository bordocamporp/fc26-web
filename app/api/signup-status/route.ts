import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "../auth/[...nextauth]/route";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          ok: false,
          signup: null,
        },
        { status: 401 }
      );
    }

    const user = session.user as any;

    const discordId = String(
      user.discordId ||
      user.discord_id ||
      user.id ||
      ""
    ).trim();

    if (!discordId) {
      return NextResponse.json({
        ok: false,
        signup: null,
        message: "Discord ID non trovato.",
      });
    }

    /*
      STEP 1
      Controlla managers
    */

    const { data: manager } = await supabase
      .from("managers")
      .select("*")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (manager) {
      return NextResponse.json({
        ok: true,
        signup: {
          status: "accepted",
          club_name: manager.club_name,
        },
      });
    }

    /*
      STEP 2
      Controlla richieste
    */

    const { data: requestData, error } = await supabase
      .from("signup_requests")
      .select("*")
      .eq("discord_id", discordId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      signup: requestData || null,
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