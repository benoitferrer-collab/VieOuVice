"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { browserClient } from "../supabase/browser";
import type { GameState } from "../game";
import { GameSessionGate } from "../game-session";
import {
  demoMessageRpc,
  type DemoMessages,
  type MessageInbox,
  type MessageDraft,
} from "./rules";
export type MessageRpc = <T>(
  name: string,
  payload?: Record<string, unknown>,
) => Promise<T>;
export function useMessages(
  game: GameState | null,
  demo: boolean,
  active: boolean,
) {
  const id = game?.id ?? "";
  const key = `${demo ? "demo" : "user"}:${id}`;
  const [gate] = useState(() => new GameSessionGate());
  const local = useRef<DemoMessages>({ messages: [], enabled: true });
  const friends = useRef<string[]>([]);
  const [drafts] = useState(() => new Map<string, MessageDraft>());
  const serial = useRef(0);
  const loadingKey = useRef("");
  const invalidate = useCallback(() => {
    serial.current++;
  }, []);
  const [result, setResult] = useState<{
    key: string;
    inbox: MessageInbox | null;
    error: string;
    unavailable: boolean;
  }>({ key: "", inbox: null, error: "", unavailable: false });
  useEffect(() => {
    friends.current =
      game?.friends.filter((f) => f.status === "accepted").map((f) => f.id) ??
      [];
  }, [game?.friends]);
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
      drafts.clear();
      data.subscription.unsubscribe();
    };
  }, [gate, id, demo, drafts]);
  const rpc: MessageRpc = useCallback(
    async <T>(name: string, payload: Record<string, unknown> = {}) => {
      if (!id) throw Error("Connecte-toi pour ouvrir tes messages.");
      const ticket = gate.capture();
      if (demo) {
        if (!gate.isDemo()) throw Error("La session a changé.");
        const reply = demoMessageRpc<T>(
          local.current,
          id,
          friends.current,
          name,
          payload,
        );
        local.current = reply.state;
        return reply.data;
      }
      if (!gate.isAccount(id)) throw Error("La session a changé.");
      const db = browserClient();
      // Pin each request to the verified account token: a concurrent login cannot send as another user.
      const { data: auth, error: sessionError } = await db.auth.getSession();
      if (sessionError || !auth.session)
        throw Error("Reconnecte-toi pour continuer.");
      const token = auth.session.access_token;
      const { data: verified, error } = await db.auth.getUser(token);
      if (error || verified.user?.id !== id || !gate.isCurrent(ticket))
        throw Error("La session a changé.");
      const reply = await db
        .rpc(name, payload)
        .setHeader("Authorization", `Bearer ${token}`);
      if (!gate.isCurrent(ticket) || !gate.isAccount(id))
        throw Error("La session a changé.");
      if (reply.error) {
        if (reply.error.code === "PGRST202" || reply.error.code === "42883")
          throw Error("MESSAGES_UNAVAILABLE");
        // RPC validation errors are written for the player; hide unexpected server details.
        if (reply.error.code === "P0001") throw Error(reply.error.message);
        throw Error("Messages indisponibles. Réessaie après reconnexion.");
      }
      return reply.data as T;
    },
    [id, demo, gate],
  );
  const refresh = useCallback(async () => {
    if (!id || loadingKey.current === key) return;
    loadingKey.current = key;
    const request = ++serial.current;
    try {
      const inbox = await rpc<MessageInbox>("get_message_inbox");
      if (request === serial.current)
        setResult({ key, inbox, error: "", unavailable: false });
    } catch (error) {
      if (request === serial.current)
        setResult({
          key,
          inbox: null,
          error:
            error instanceof Error && error.message !== "MESSAGES_UNAVAILABLE"
              ? error.message
              : "La messagerie sera disponible après la mise à jour du jeu.",
          unavailable:
            error instanceof Error && error.message === "MESSAGES_UNAVAILABLE",
        });
    } finally {
      if (loadingKey.current === key) loadingKey.current = "";
    }
  }, [id, key, rpc]);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const tick = () => {
      if (active && !document.hidden) void refresh();
    };
    const timer = setInterval(tick, 10000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      invalidate();
      window.clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh, active, invalidate]);
  return {
    rpc,
    refresh,
    drafts,
    inbox: result.key === key ? result.inbox : null,
    error: result.key === key ? result.error : "",
    unavailable: result.key === key && result.unavailable,
  };
}
