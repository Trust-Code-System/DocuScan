"use client";

import { useCallback, useEffect, useState } from "react";
import { track, Events, toolFromPath } from "@/lib/analytics";

export type Usage = { used: number; limit: number; remaining: number };

/**
 * Loads the guest's remaining daily quota and exposes `consume()`, which the
 * server enforces (returns 429 when the limit is hit). Returns null on success
 * or a user-facing message string when blocked.
 */
export function useGuestTask() {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => {});
  }, []);

  const consume = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/usage", { method: "POST" });
      const u: Usage = await res.json();
      setUsage(u);
      const tool = toolFromPath(window.location.pathname);
      if (res.status === 429) {
        track(Events.ToolError, { tool, reason: "limit_reached" });
        return `You've reached today's free limit (${u.limit} tasks). Come back tomorrow for more.`;
      }
      track(Events.ToolRun, { tool });
      return null;
    } catch {
      return "Couldn't reach the server. Check your connection and try again.";
    }
  }, []);

  return { usage, consume };
}
