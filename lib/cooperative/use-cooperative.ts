"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "../game";
import { browserClient } from "../supabase/browser";
import { GameSessionGate } from "../game-session";
import type { HubRpc } from "../events/types";
import type { CoopHub } from "./types";
import { coopDemoRpc, makeCoopDemo, type CoopDemo } from "./demo";
export function useCooperative(game: GameState | null, demo: boolean) {
  const id = game?.id ?? "";
  const key = `${demo}:${id}`;
  const [gate] = useState(() => new GameSessionGate());
  const local = useRef<CoopDemo | null>(null);
  const currentGame = useRef(game);
  const serial = useRef(0);
  const [result, setResult] = useState<{
    key: string;
    hub: CoopHub | null;
    error: string;
  }>({ key: "", hub: null, error: "" });
  useEffect(() => {
    currentGame.current = game;
  }, [game]);
  useEffect(() => {
    if (demo) gate.enterDemo();
    else if (id) gate.enterAccount(id);
    else gate.enterSignedOut();
    if (demo || !id)
      return () => {
        gate.enterSignedOut();
      };
    const { data } = browserClient().auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" || (session && session.user.id !== id))
          gate.enterSignedOut();
      },
    );
    return () => {
      gate.enterSignedOut();
      data.subscription.unsubscribe();
    };
  }, [gate, demo, id]);
  const rpc: HubRpc = useCallback(
    async <T>(name: string, p: Record<string, unknown> = {}) => {
      const ticket = gate.capture();
      if (!id) throw Error("Connecte-toi pour continuer.");
      if (demo) {
        if (!gate.isDemo() || !currentGame.current)
          throw Error("La session a changé.");
        local.current ??= makeCoopDemo();
        const reply = coopDemoRpc(local.current, currentGame.current, name, p);
        local.current = reply.state;
        return reply.data as T;
      }
      if (!gate.isAccount(id)) throw Error("La session a changé.");
      const db = browserClient();
      const { data: session } = await db.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw Error("Reconnecte-toi pour continuer.");
      const { data: verified, error } = await db.auth.getUser(token);
      if (error || verified.user?.id !== id || !gate.isCurrent(ticket))
        throw Error("La session a changé.");
      const reply = await db
        .rpc(name, p)
        .setHeader("Authorization", `Bearer ${token}`);
      if (!gate.isCurrent(ticket) || !gate.isAccount(id))
        throw Error("La session a changé.");
      if (reply.error) {
        if (["PGRST202", "42883"].includes(reply.error.code))
          throw Error("Disponible après la mise à jour du jeu.");
        throw Error(
          reply.error.code === "P0001"
            ? reply.error.message
            : "Chargement impossible. Réessaie.",
        );
      }
      return reply.data as T;
    },
    [gate, demo, id],
  );
  const invalidate = useCallback(() => {
    serial.current++;
  }, []);
  const refresh = useCallback(async () => {
    if (!id) return;
    const n = ++serial.current;
    try {
      const hub = await rpc<CoopHub>("get_cooperative_hub");
      if (n === serial.current) setResult({ key, hub, error: "" });
    } catch (e) {
      if (n === serial.current)
        setResult({
          key,
          hub: null,
          error: e instanceof Error ? e.message : "Défis indisponibles.",
        });
    }
  }, [id, key, rpc]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    const timer = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      invalidate();
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh, game?.actions, invalidate]);
  const resetDemo = () => {
    if (demo) {
      local.current = makeCoopDemo();
      void refresh();
    }
  };
  return {
    rpc,
    refresh,
    resetDemo,
    hub: result.key === key ? result.hub : null,
    error: result.key === key ? result.error : "",
  };
}
