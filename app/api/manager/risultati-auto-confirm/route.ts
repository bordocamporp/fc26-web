import { NextRequest, NextResponse } from "next/server";
import { finalizeResultByPending, getSupabaseAdmin } from "../_resultShared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET || "";

    if (cronSecret && auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: expired, error } = await supabase
      .from("pending_result_confirmations")
      .select("*")
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .limit(20);

    if (error) throw error;

    let confirmed = 0;

    for (const pending of expired || []) {
      try {
        await finalizeResultByPending(pending, "auto_accepted");
        confirmed += 1;
      } catch (error) {
        console.error("[AUTO CONFIRM] pending", pending.id, error);
      }
    }

    return NextResponse.json({ ok: true, confirmed });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Errore auto conferma." },
      { status: 500 }
    );
  }
}
