import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function clean(value: any) {
  return String(value || "").trim();
}

function norm(value: any) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function normalizePlayer(player: any) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    team: player.team,
    nation: player.nation,
    nationality: player.nationality,
    league: player.league,
    overall: player.overall,
    pace: player.pace,
    pac: player.pac,
    shooting: player.shooting,
    sho: player.sho,
    passing: player.passing,
    pas: player.pas,
    dribbling: player.dribbling,
    dri: player.dri,
    defending: player.defending,
    def: player.def,
    physical: player.physical,
    phy: player.phy,
    age: player.age,
    weak_foot: player.weak_foot,
    skill_moves: player.skill_moves,
    market_value: player.market_value,
    image_url: player.image_url || player.card_url || player.photo_url || player.avatar_url,
    card_url: player.card_url,
    owner_discord_id: player.owner_discord_id,
  };
}

async function searchPlayers(q: string) {
  if (q.length < 2) return [];

  const like = `%${q}%`;

  const searches = [
    supabase.from("players").select("*").ilike("name", like).limit(40),
    supabase.from("players").select("*").ilike("team", like).limit(40),
    supabase.from("players").select("*").ilike("position", like).limit(40),
    supabase.from("players").select("*").ilike("nation", like).limit(40),
    supabase.from("players").select("*").ilike("nationality", like).limit(40),
    supabase.from("players").select("*").ilike("league", like).limit(40),
  ];

  const results = await Promise.all(searches);
  const map = new Map<string, any>();

  for (const result of results) {
    if (result.error) continue;

    for (const player of result.data || []) {
      map.set(String(player.id), player);
    }
  }

  const queryNorm = norm(q);

  const players = Array.from(map.values())
    .filter((player) => {
      const values = [
        player.name,
        player.team,
        player.position,
        player.nation,
        player.nationality,
        player.league,
      ];

      return values.some((value) => norm(value).includes(queryNorm));
    })
    .sort((a, b) => Number(b.overall || 0) - Number(a.overall || 0))
    .slice(0, 50);

  return players.map(normalizePlayer);
}

async function getManagersByDiscordIds(ownerIds: string[]) {
  if (ownerIds.length === 0) return {};

  const { data } = await supabase
    .from("managers")
    .select("*")
    .in("discord_id", ownerIds);

  return Object.fromEntries(
    (data || []).map((manager: any) => [String(manager.discord_id), manager])
  );
}

async function getTransferUpdates() {
  const candidates = [
    {
      table: "transfer_history",
      select: "*",
    },
    {
      table: "market_history",
      select: "*",
    },
    {
      table: "transfers",
      select: "*",
    },
  ];

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from(candidate.table)
      .select(candidate.select)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      return data.map((row: any) => ({
        id: `${candidate.table}-${row.id}`,
        player_name: row.player_name || row.name || row.description,
        from_manager_name: row.from_manager_name || row.from_manager || row.seller_name,
        to_manager_name: row.to_manager_name || row.to_manager || row.buyer_name,
        manager_name: row.manager_name || row.discord_tag || row.owner_tag,
        price: row.price || row.amount || row.value,
        source: row.source || row.type || candidate.table,
        type: row.type || row.source,
        created_at: row.created_at,
        description: row.description,
      }));
    }
  }

  return [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = clean(searchParams.get("q"));

  const basePlayers = await searchPlayers(q);

  const ownerIds = Array.from(
    new Set(
      basePlayers
        .map((player) => clean(player.owner_discord_id))
        .filter(Boolean)
    )
  );

  const managersByDiscordId = await getManagersByDiscordIds(ownerIds);

  const players = basePlayers.map((player: any) => {
    const ownerId = clean(player.owner_discord_id);
    const manager = ownerId ? managersByDiscordId[ownerId] : null;

    return {
      ...player,
      owner_discord_id: undefined,
      owner_tag: publicOwnerTag(manager),
      owner_club: manager?.club_name || null,
      is_owned: Boolean(ownerId && manager),
    };
  });

  const updates = await getTransferUpdates();

  return NextResponse.json({
    players,
    updates,
  });
}
