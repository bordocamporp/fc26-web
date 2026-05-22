import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  buildResultText,
  formatScorers,
  getSiteUrl,
  getSupabaseAdmin,
  sendDiscordDm,
  sendDiscordMessage,
  RESULTS_CHANNEL_ID,
} from "../_resultShared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const supabase = getSupabaseAdmin();

    const match = payload.match || {};
    const sourceTable = String(match.source_table || "");
    const sourceMatchId = String(match.id || "");
    const submitterId = String(payload.userId || "");

    const opponentId =
      String(match.home_user_id || "") === submitterId
        ? String(match.away_user_id || "")
        : String(match.home_user_id || "");

    if (!submitterId || !sourceTable || !sourceMatchId || !opponentId) {
      return NextResponse.json({ error: "Dati risultato mancanti." }, { status: 400 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase
      .from(sourceTable)
      .update({
        home_goals: Number(payload.home_score || 0),
        away_goals: Number(payload.away_score || 0),
        status: "awaiting_confirmation",
        submitted_by: submitterId,
      })
      .eq("id", sourceMatchId);

    const { data: pending, error } = await supabase
      .from("pending_result_confirmations")
      .insert({
        token,
        source_table: sourceTable,
        source_match_id: sourceMatchId,
        submitter_id: submitterId,
        opponent_id: opponentId,
        status: "pending",
        payload,
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (error) throw error;

    const siteUrl = getSiteUrl();
    const acceptUrl = `${siteUrl}/api/manager/risultati-confirm/${token}`;
    const contestUrl = `${siteUrl}/api/manager/risultati-contest/${token}`;

    const dmInfo = await sendDiscordDm(opponentId, {
      embeds: [
        {
          title: "⚽ Conferma risultato partita",
          description:
            `**${match.competition_name || "Competizione"} - ${match.home_club} vs ${match.away_club}**\n\n` +
            `🏟️ **Risultato:** ${buildResultText(payload)}\n\n` +
            `⚽ **Marcatori**\n${formatScorers(payload.scorers || [])}\n\n` +
            `Hai **1 ora** per accettare o contestare. Se non rispondi, sarà accettato automaticamente.`,
          color: 0x84cc16,
          footer: { text: "Bordo Campo FC26 • Conferma risultato" },
          timestamp: new Date().toISOString(),
        },
      ],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: "✅ ACCETTA RISULTATO", url: acceptUrl },
            { type: 2, style: 5, label: "⚠️ FAI RICORSO", url: contestUrl },
          ],
        },
      ],
    });

    if (dmInfo?.dm_channel_id && dmInfo?.dm_message_id) {
      await supabase
        .from("pending_result_confirmations")
        .update({
          dm_channel_id: dmInfo.dm_channel_id,
          dm_message_id: dmInfo.dm_message_id,
        })
        .eq("id", pending.id);
    }

    await sendDiscordMessage(RESULTS_CHANNEL_ID, {
      embeds: [
        {
          title: "⏳ RISULTATO IN ATTESA DI CONFERMA",
          description:
            `**${match.competition_name || "Competizione"} - ${match.home_club} vs ${match.away_club}**\n\n` +
            `🏟️ **Risultato proposto:** ${buildResultText(payload)}\n` +
            `👤 Inviato da: <@${submitterId}>\n` +
            `👤 Deve confermare: <@${opponentId}>\n\n` +
            `Scadenza: <t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>`,
          color: 0xf59e0b,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Errore invio risultato." }, { status: 500 });
  }
}
