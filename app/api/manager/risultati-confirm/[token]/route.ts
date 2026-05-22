import { NextResponse } from "next/server";
import { finalizeResultByPending, getSupabaseAdmin } from "../../_resultShared";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getSupabaseAdmin();

    const { data: pending, error } = await supabase
      .from("pending_result_confirmations")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !pending) {
      return new Response(renderPage("Link non valido", "Questo risultato non esiste o il link è scaduto."), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 404,
      });
    }

    if (pending.status !== "pending") {
      return new Response(renderPage("Risposta già registrata", "Questo risultato è già stato gestito."), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    await finalizeResultByPending(pending, "accepted");

    return new Response(renderPage("Risultato accettato", "La partita è stata aggiornata e pubblicata nel canale risultati."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Errore conferma." }, { status: 500 });
  }
}

function renderPage(title: string, text: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body{margin:0;background:#020403;color:white;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}
    .card{max-width:640px;border:1px solid rgba(132,204,22,.35);border-radius:32px;background:rgba(255,255,255,.04);padding:40px;box-shadow:0 0 60px rgba(132,204,22,.14)}
    h1{font-size:42px;margin:0 0 16px;font-weight:900}
    p{color:#cbd5e1;font-size:18px;line-height:1.6}
    a{display:inline-block;margin-top:24px;background:#84cc16;color:#000;padding:16px 24px;border-radius:18px;font-weight:900;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${text}</p>
    <a href="/manager">Torna al manager</a>
  </div>
</body>
</html>`;
}
