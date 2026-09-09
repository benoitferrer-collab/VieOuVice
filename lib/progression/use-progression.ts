"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "../game";
import type { HubRpc, SocialHub } from "../events/types";
import { browserClient } from "../supabase/browser";
import {
  makeDemoProgression,
  progressionRpc,
  type DemoProgression,
} from "./demo";
import type { PlayerLook, ProgressionState } from "./types";
const STORAGE = "exces-o-meter:progression:v1";
export function useProgression(
  game: GameState | null,
  demo: boolean,
  social: SocialHub | null,
) {
  const key = game ? `${demo ? "demo" : "user"}:${game.id}` : "";
  const current = useRef({ game, demo, social, key });
  const epoch = useRef(0),
    serial = useRef(0);
  useEffect(() => {
    current.current = { game, demo, social, key };
  }, [game, demo, social, key]);
  const invalidate = useCallback(() => {
    epoch.current++;
    serial.current++;
  }, []);
  useEffect(() => () => invalidate(), [key, invalidate]);
  const local = useRef<DemoProgression | null>(null);
  const [result, setResult] = useState<{
    key: string;
    data: ProgressionState | null;
    looks: Record<string, PlayerLook>;
    error: string;
  }>({ key: "", data: null, looks: {}, error: "" });
  const getLocal = useCallback(() => {
    if (!local.current) {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
        if (
          saved?.version === 1 &&
          saved.choices &&
          typeof saved.choices === "object" &&
          Array.isArray(saved.awards) &&
          saved.equipped &&
          saved.reactions &&
          typeof saved.notify_reactions === "boolean"
        )
          local.current = saved;
      } catch {}
    }
    return (local.current ||= makeDemoProgression());
  }, []);
  const persist = useCallback((value: DemoProgression) => {
    local.current = value;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(value));
    } catch {}
  }, []);
  const rpc: HubRpc = useCallback(
    async <T>(
      name: string,
      payload: Record<string, unknown> = {},
    ): Promise<T> => {
      const input = current.current,
        generation = epoch.current;
      if (!key || input.key !== key || !input.game)
        throw Error("Reconnecte-toi pour continuer.");
      if (input.demo) {
        const response = progressionRpc(
          getLocal(),
          input.game,
          input.social?.events || [],
          input.social?.badges || [],
          name,
          payload,
        );
        persist(response.next);
        return response.data as T;
      }
      if (!navigator.onLine)
        throw Error("Hors connexion. Réessaie après reconnexion.");
      const response = await browserClient().rpc(name, payload);
      if (current.current.key !== key || epoch.current !== generation)
        throw Error("La session a changé.");
      if (response.error)
        throw Object.assign(
          new Error(response.error.message || "Opération non confirmée."),
          { code: response.error.code },
        );
      return response.data as T;
    },
    [key, getLocal, persist],
  );
  const refresh = useCallback(async () => {
    if (!key || current.current.key !== key || !current.current.game) return;
    const request = ++serial.current;
    try {
      const data = await rpc<ProgressionState>("get_progression");
      const input = current.current.game;
      if (!input || current.current.key !== key || request !== serial.current)
        return;
      const ids = [
        ...new Set([
          input.id,
          ...input.players.map((p) => p.id),
          ...input.friends
            .filter((f) => f.status === "accepted")
            .map((f) => f.id),
        ]),
      ];
      const looks: Record<string, PlayerLook> = {};
      for (let i = 0; i < ids.length; i += 60) {
        const rows = await rpc<PlayerLook[]>("get_player_looks", {
          p_user_ids: ids.slice(i, i + 60),
        });
        for (const row of rows) looks[row.user_id] = row;
      }
      if (request === serial.current && current.current.key === key)
        setResult({ key, data, looks, error: "" });
    } catch (caught) {
      if (request !== serial.current || current.current.key !== key) return;
      const code = (caught as { code?: string })?.code;
      setResult({
        key,
        data: null,
        looks: {},
        error:
          code === "PGRST202" || code === "42883"
            ? ""
            : caught instanceof Error
              ? caught.message
              : "Progression indisponible.",
      });
    }
  }, [key, rpc]);
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh, game?.actions, social?.events, social?.badges]);
  const resetDemo = () => {
    if (demo) {
      persist(makeDemoProgression());
      void refresh();
    }
  };
  return {
    data: result.key === key ? result.data : null,
    looks: result.key === key ? result.looks : {},
    error: result.key === key ? result.error : "",
    rpc,
    refresh,
    resetDemo,
  };
}
