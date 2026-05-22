import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function clean(value: string | null) {
  return String(value || "").trim();
}

function publicOwnerTag(manager: any) {
  if (!manager) return null;

  return (
    manager.discord_tag ||
    manager.tag ||
    manager.username ||
    manager.discord_name ||
    manager.manager_name ||
    manager.name ||
    "Manager registrato"
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = clean(searchParams.get("q"));

  let players: any[] = [];

  if (q.length >= 2) {
    const like = `%${q}%`;

    const { data } = await supabase
      .from("players")
      .select("*")
      .or(
        [
          `name.ilike.${like}`,
          `team.ilike.${like}`,
          `position.ilike.${like}`,
          `nation.ilike.${like}`,
          `nationality.ilike.${like}`,
          `league.ilike.${like}`,
        ].join(",")
      )
      .order("overall", { ascending: false })
      .limit(30);

    players = data || [];
  }

  const ownerIds = Array.from(
    new Set(
      players
        .map((player) => String(player.owner_discord_id || "").trim())
        .filter(Boolean)
    )
  );

  let managersByDiscordId: Record<string, any> = {};

  if (ownerIds.length > 0) {
    const { data: managers } = await supabase
      .from("managers")
      .select("*")
      .in("discord_id", ownerIds);

    managersByDiscordId = Object.fromEntries(
      (managers || []).map((manager: any) => [String(manager.discord_id), manager])
    );
  }

  const enrichedPlayers = players.map((player: any) => {
    const ownerDiscordId = String(player.owner_discord_id || "").trim();
    const manager = ownerDiscordId ? managersByDiscordId[ownerDiscordId] : null;

    return {
      ...player,
      owner_discord_id: undefined,
      owner_tag: publicOwnerTag(manager),
      owner_club: manager?.club_name || null,
      is_owned: Boolean(ownerDiscordId),
    };
  });

  const { data: updates } = await supabase
    .from("transfer_history")
    .select("id, player_name, manager_name, price, source, created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  return NextResponse.json({
    players: enrichedPlayers,
    updates: updates || [],
  });
}
