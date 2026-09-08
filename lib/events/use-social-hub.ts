"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "../game";
import { browserClient } from "../supabase/browser";
import type { HubRpc, SocialHub } from "./types";
import {
  demoHubRpc,
  getDemoHub,
  makeDemoSocialState,
  settleDemoEvents,
  type DemoSocialState,
} from "./demo";
const STORAGE = "exces-o-meter:demo-social:v1";
export function useSocialHub(game: GameState | null, demo: boolean) {
  const key = game ? `${demo ? "demo" : "user"}:${game.id}` : "";
  const current = useRef({ game, demo, key });
  useEffect(() => {
    current.current = { game, demo, key };
  }, [game, demo, key]);
  const local = useRef<DemoSocialState | null>(null);
  const serial = useRef(0);
  const invalidateRefresh = useCallback(() => {
    serial.current++;
  }, []);
  const [result, setResult] = useState<{
    key: string;
    hub: SocialHub | null;
    error: string;
  }>({ key: "", hub: null, error: "" });
  const getLocal = useCallback(() => {
    if (local.current) return local.current;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
      if (
        saved?.version === 1 &&
        Array.isArray(saved.events) &&
        Array.isArray(saved.badges) &&
        saved.finals &&
        typeof saved.share_history === "boolean"
      )
        local.current = saved;
    } catch {}
    return (local.current ||= makeDemoSocialState());
  }, []);
  const saveLocal = useCallback((value: DemoSocialState) => {
    local.current = value;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(value));
    } catch {}
  }, []);
  const refresh = useCallback(async () => {
    if (!key || !current.current.game) return;
    const request = ++serial.current;
    try {
      let hub: SocialHub | null;
      if (demo) {
        const next = settleDemoEvents(getLocal(), current.current.game);
        saveLocal(next);
        hub = getDemoHub(next, current.current.game);
      } else {
        const response = await browserClient().rpc("get_social_hub");
        if (response.error) {
          if (
            response.error.code === "PGRST202" ||
            response.error.code === "42883"
          )
            hub = null;
          else
            throw Error(
              response.error.message ||
                "Chargement des compétitions impossible.",
            );
        } else hub = response.data as SocialHub;
      }
      if (request === serial.current && current.current.key === key)
        setResult({ key, hub, error: "" });
    } catch (error) {
      if (request === serial.current && current.current.key === key)
        setResult({
          key,
          hub: null,
          error:
            error instanceof Error ? error.message : "Chargement impossible.",
        });
    }
  }, [key, demo, getLocal, saveLocal]);
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    const timer = window.setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      invalidateRefresh();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh, game?.actions, invalidateRefresh]);
  const rpc: HubRpc = useCallback(
    async <T>(
      name: string,
      payload: Record<string, unknown> = {},
    ): Promise<T> => {
      if (!key || !current.current.game || current.current.key !== key)
        throw Error("Reconnecte-toi pour continuer.");
      if (demo) {
        const response = demoHubRpc(
          getLocal(),
          current.current.game,
          name,
          payload,
        );
        saveLocal(response.next);
        setResult({
          key,
          hub: getDemoHub(response.next, current.current.game),
          error: "",
        });
        return response.data as T;
      }
      if (!navigator.onLine)
        throw Error("Hors connexion. Réessaie après reconnexion.");
      const response = await browserClient().rpc(name, payload);
      if (current.current.key !== key) throw Error("La session a changé.");
      if (response.error)
        throw Error(response.error.message || "Opération non confirmée.");
      return response.data as T;
    },
    [key, demo, getLocal, saveLocal],
  );
  function resetDemo() {
    if (demo) {
      saveLocal(makeDemoSocialState());
      void refresh();
    }
  }
  return {
    hub: result.key === key ? result.hub : null,
    error: result.key === key ? result.error : "",
    rpc,
    refresh,
    resetDemo,
  };
}
