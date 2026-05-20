"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

export default function AnalyticsTracker({
  page,
}: {
  page: string;
}) {
  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function trackView() {
      console.log("TRACK START", page);

      const { data, error } = await supabase
        .from("site_analytics")
        .insert([
          {
            page,
            event: "view",
            user_agent: navigator.userAgent,
          },
        ]);

      console.log("DATA:", data);

      if (error) {
        console.error("ANALYTICS ERROR:", error);
      } else {
        console.log("ANALYTICS OK:", page);
      }
    }

    trackView();
  }, [page]);

  return null;
}