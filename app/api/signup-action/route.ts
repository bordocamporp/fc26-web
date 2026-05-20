import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "../auth/[...nextauth]/route";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function normalizeAction(action: string) {
  const value = String(action || "").toLowerCase().trim();

  if (["accept", "accepted", "accetta", "approve", "approved"].includes(value)) {
    return "accepted";
  }

  if (["reject", "rejected", "rifiuta", "deny", "denied"].includes(value)) {
    return "rejected";
  }

  return "";
}

function getDiscordId(user: any) {
  return String(
    user?.discordId ||
      user?.discord_id ||
      user?.id ||
      ""
  ).trim();
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, message: "Non autorizzato." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const requestId = body.request_id || body.signup_id || body.id;
    const action = normalizeAction(body.action || body.status);
    const clubName =
      body.club_name ||
      body.clubName ||
      body.club ||
      body.team ||
      null;

    if (!requestId) {
      return NextResponse.json(
        { ok: false, message: "ID richiesta mancante.", received: body },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { ok: false, message: "Azione non valida.", received: body },
        { status: 400 }
      );
    }

    if (action === "accepted" && !clubName) {
      return NextResponse.json(
        { ok: false, message: "Seleziona un club prima di accettare." },
        { status: 400 }
      );
    }

    const staffDiscordId = getDiscordId(session.user as any);
    const staffName = session.user?.name || staffDiscordId || "website";

    const { data: actionRow, error: actionError } = await supabase
      .from("signup_staff_actions")
      .insert([
        {
          request_id: Number(requestId),
          action,
          club_name: action === "accepted" ? clubName : null,
          handled_by: staffDiscordId || "website",
          handled_by_name: staffName,
          source: "website",
          processed: false,
        },
      ])
      .select()
      .single();

    if (actionError) {
      return NextResponse.json(
        {
          ok: false,
          step: "insert signup_staff_actions",
          message: actionError.message,
          error: actionError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      queued: true,
      action,
      queue: actionRow,
      message:
        action === "accepted"
          ? "Accettazione inviata al bot Discord."
          : "Rifiuto inviato al bot Discord.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        step: "catch",
        message: err?.message || "Errore server.",
        error: String(err),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "signup-action API attiva. Usa POST.",
  });
}
