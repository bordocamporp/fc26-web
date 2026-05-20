"use client";

import { useMemo, useState } from "react";

function isValidLogoUrl(value?: string | null) {
  const clean = String(value || "").trim();

  if (!clean) return false;
  if (clean.startsWith("URL_LOGO_")) return false;
  if (clean === "null" || clean === "undefined") return false;

  return (
    clean.startsWith("http://") ||
    clean.startsWith("https://") ||
    clean.startsWith("/")
  );
}

export default function ClubLogo({
  clubName,
  logoUrl,
}: {
  clubName: string;
  logoUrl?: string | null;
}) {
  const initials = useMemo(() => {
    return String(clubName || "FC")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 3);
  }, [clubName]);

  const [showBadge, setShowBadge] = useState(!isValidLogoUrl(logoUrl));
  const src = isValidLogoUrl(logoUrl) ? String(logoUrl) : "";

  return (
    <div className="relative flex h-52 w-52 shrink-0 items-center justify-center overflow-hidden rounded-[2.2rem] border border-lime-400/30 bg-black/50 shadow-[0_0_60px_rgba(132,204,22,0.18)]">
      <div className="absolute inset-0 rounded-[2.2rem] bg-lime-400/10 blur-xl" />
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-lime-400/20 blur-2xl" />
      <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-emerald-500/15 blur-2xl" />

      {!showBadge && src ? (
        <img
          src={src}
          alt={clubName}
          className="relative z-10 h-36 w-36 object-contain"
          onError={() => setShowBadge(true)}
        />
      ) : (
        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full border border-lime-400/50 bg-gradient-to-br from-lime-400/30 via-lime-400/10 to-black text-5xl font-black text-lime-400 shadow-[0_0_35px_rgba(132,204,22,0.25)]">
            {initials}
          </div>

          <p className="mt-4 max-w-[150px] text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
            {clubName}
          </p>
        </div>
      )}
    </div>
  );
}
