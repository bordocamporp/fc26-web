import { createClient } from "@supabase/supabase-js";
import SignupActionButtons from "../components/SignupActionButtons";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getRequests() {
  const { data, error } = await supabase
    .from("signup_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Errore caricamento signup_requests:", error.message);
    return [];
  }

  return data || [];
}

async function getAnalytics() {
  const { data, error } = await supabase
    .from("site_analytics")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Errore caricamento site_analytics:", error.message);
    return [];
  }

  return data || [];
}

function getDisplayName(user: any) {
  return (
    user.discord_name ||
    user.username ||
    user.ea_id ||
    user.game_id ||
    "Utente senza nome"
  );
}

function getSource(user: any) {
  return user.signup_source || user.source || "website";
}

function getClub(user: any) {
  return user.club_name || user.club || null;
}

function UserColumn({
  title,
  color,
  users,
}: {
  title: string;
  color: string;
  users: any[];
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-black/40 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className={`text-3xl font-black ${color}`}>{title}</h2>

        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl font-bold text-white">
          {users.length}
        </div>
      </div>

      <div className="space-y-6">
        {users.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-zinc-500">
            Nessun utente in questa sezione.
          </div>
        )}

        {users.map((user) => (
          <div
            key={user.id}
            className="rounded-[2rem] border border-white/10 bg-black/60 p-6"
          >
            <h3 className="text-3xl font-black text-white">
              {getDisplayName(user)}
            </h3>

            <div className="mt-4 space-y-1 text-base text-zinc-400">
              <p>Discord ID: {user.discord_id || "N/D"}</p>
              <p>Platform: {user.platform || "N/D"}</p>

              {(user.ea_id || user.game_id) && (
                <p>EA / Game ID: {user.ea_id || user.game_id}</p>
              )}

              <p>Fonte: {getSource(user)}</p>

              {getClub(user) && (
                <p className="font-bold text-lime-400">
                  Club assegnato: {getClub(user)}
                </p>
              )}
            </div>

            <div className="mt-6">
              {user.status === "pending" ? (
                <SignupActionButtons requestId={Number(user.id)} />
              ) : (
                <div className="inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white">
                  {user.status}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function StaffPage() {
  const requests = await getRequests();
  const analytics = await getAnalytics();

  const pending = requests.filter((r: any) => r.status === "pending");
  const accepted = requests.filter((r: any) => r.status === "accepted");
  const rejected = requests.filter((r: any) => r.status === "rejected");

  const totalViews = analytics.length;

  const pageStats: Record<string, number> = {};

  analytics.forEach((item: any) => {
    const page = item.page || "unknown";
    pageStats[page] = (pageStats[page] || 0) + 1;
  });

  const topPages = Object.entries(pageStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 rounded-[2rem] border border-lime-500/20 bg-gradient-to-r from-lime-500/20 to-transparent p-8">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.4em] text-lime-400">
            Dashboard Pro
          </p>

          <h1 className="text-6xl font-black">Gestione Bordo Campo</h1>

          <p className="mt-4 max-w-3xl text-xl text-zinc-300">
            Le azioni Accetta/Rifiuta vengono inviate al bot Discord, che
            aggiorna il database, assegna ruoli e manda i messaggi privati.
          </p>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-[2rem] border border-white/10 bg-black/40 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              In attesa
            </p>
            <h2 className="mt-4 text-6xl font-black text-orange-400">
              {pending.length}
            </h2>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/40 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              Accettati
            </p>
            <h2 className="mt-4 text-6xl font-black text-lime-400">
              {accepted.length}
            </h2>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/40 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              Rifiutati
            </p>
            <h2 className="mt-4 text-6xl font-black text-red-400">
              {rejected.length}
            </h2>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/40 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              Visite sito
            </p>
            <h2 className="mt-4 text-6xl font-black text-cyan-400">
              {totalViews}
            </h2>
          </div>
        </div>

        <div className="mb-10 rounded-[2rem] border border-white/10 bg-black/40 p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-4xl font-black">Pagine più viste</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {topPages.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-zinc-500">
                Nessun dato analytics disponibile.
              </div>
            )}

            {topPages.map(([page, count]) => {
              const percent =
                totalViews > 0 ? Math.min((count / totalViews) * 100, 100) : 0;

              return (
                <div
                  key={page}
                  className="rounded-2xl border border-white/10 bg-black/40 p-6"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-2xl font-black uppercase">{page}</h3>

                    <span className="font-bold text-lime-400">
                      {count} visite
                    </span>
                  </div>

                  <div className="h-4 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-lime-400"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-3">
          <UserColumn
            title="In attesa"
            color="text-orange-400"
            users={pending}
          />

          <UserColumn
            title="Accettati"
            color="text-lime-400"
            users={accepted}
          />

          <UserColumn
            title="Rifiutati"
            color="text-red-400"
            users={rejected}
          />
        </div>
      </div>
    </main>
  );
}
