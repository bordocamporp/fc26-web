import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ signup: null });
  }

  const user = session.user as any;

  const discordId = String(
    user.discordId ||
    user.discord_id ||
    user.sub ||
    user.id ||
    ""
  ).trim();

  if (!discordId) {
    return NextResponse.json({ signup: null });
  }

  const { data: signup } = await supabase
    .from("signup_requests")
    .select("*")
    .eq("discord_id", discordId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ signup: signup || null });
}
