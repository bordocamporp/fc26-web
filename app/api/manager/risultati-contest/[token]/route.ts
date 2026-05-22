import { NextResponse } from "next/server";
import {
  buildResultText,
  closeDiscordDmMessage,
  formatScorers,
  getSupabaseAdmin,
  RESULTS_CHANNEL_ID,
  sendDiscordMessage,
} from "../../_resultShared";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: pending } = await supabase
    .from("pending_result_confirmations")
    .select("*")
    .eq("token", token)
    .single();

  if (!pending) {
    return html("Link non valido", "Questo risultato non esiste.");
  }

  if (pending.status !== "pending") {
    await closeDiscordDmMessage(
      pending,
      "ℹ️ Conferma già chiusa",
      "Questo risultato è già stato gestito.",
      0x64748b
    );
    return html("Già gestito", "Questo risultato è già stato gestito.");
  }

  await supabase
    .from("pending_result_confirmations")
    .update({
      status: "contested",
      responded_at: new Date().toISOString(),
    })
    .eq("id", pending.id);

  const payload = pending.payload || {};
  const match = payload.match || {};

  await supabase
    .from(String(pending.source_table))
    .update({ status: "contested" })
    .eq("id", pending.source_match_id);

  await sendDiscordMessage(RESULTS_CHANNEL_ID, {
    embeds: [
      {
        title: "⚠️ RICORSO RISULTATO",
        description:
          `**${match.competition_name || "Competizione"} - ${match.home_club} vs ${match.away_club}**\n\n` +
          `🏟️ **Risultato contestato:** ${buildResultText(payload)}\n` +
          `👤 Inviato da: <@${pending.submitter_id}>\n` +
          `👤 Contestato da: <@${pending.opponent_id}>\n\n` +
          `⚽ **Marcatori dichiarati**\n${formatScorers(payload.scorers || [])}`,
        color: 0xef4444,
        timestamp: new Date().toISOString(),
      },
    ],
  });

  await closeDiscordDmMessage(
    pending,
    "⚠️ Ricorso inviato",
    "La contestazione è stata inviata allo staff. I pulsanti sono stati chiusi.",
    0xef4444
  );

  return html("Ricorso inviato", "Lo staff controllerà il risultato.");
}

function html(title: string, text: string) {
  return new Response(`<!doctype html><html><body style="margin:0;background:#020403;color:white;font-family:Arial;display:grid;place-items:center;min-height:100vh"><div style="max-width:620px;border:1px solid #ef4444;border-radius:28px;padding:40px;background:#111"><h1>${title}</h1><p>${text}</p><a href="/manager" style="color:#ef4444;font-weight:900">Torna al manager</a></div></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
