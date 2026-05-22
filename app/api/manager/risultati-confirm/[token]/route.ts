import { NextResponse } from "next/server";
import { closeDiscordDmMessage, getSupabaseAdmin } from "../../_resultShared";
import { finalizeResultByPending } from "../../_resultShared";

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

  await finalizeResultByPending(pending, "accepted");

  await closeDiscordDmMessage(
    pending,
    "✅ Risultato accettato",
    "Hai confermato il risultato. La partita è stata aggiornata e pubblicata nel canale risultati.",
    0x84cc16
  );

  return html("Risultato accettato", "La partita è stata aggiornata e il messaggio Discord è stato chiuso.");
}

function html(title: string, text: string) {
  return new Response(`<!doctype html><html><body style="margin:0;background:#020403;color:white;font-family:Arial;display:grid;place-items:center;min-height:100vh"><div style="max-width:620px;border:1px solid #84cc16;border-radius:28px;padding:40px;background:#111"><h1>${title}</h1><p>${text}</p><a href="/manager" style="color:#84cc16;font-weight:900">Torna al manager</a></div></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
