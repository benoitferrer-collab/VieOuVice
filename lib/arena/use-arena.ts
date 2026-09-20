"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { browserClient } from "../supabase/browser";
import { GameSessionGate } from "../game-session";
import type { GameState } from "../game";
import type { ArenaDuel } from "./rules";
import { demoArenaRpc, emptyArena, type ArenaDemo } from "./demo";
export function useArena(
  game: GameState,
  demo: boolean,
  active: boolean,
  selectedId: string | null,
  onReward: () => void,
) {
  const key = `${demo ? "demo" : "user"}:${game.id}`;
  const [gate] = useState(() => new GameSessionGate());
  const gameRef = useRef(game),
    rewardRef = useRef(onReward);
  const requests = useRef(new Map<string, string>()),
    local = useRef<ArenaDemo>(emptyArena());
  const generation = useRef(0),
    serial = useRef(0),
    lock = useRef(false),
    blocked = useRef(true);
  const [busy, setBusy] = useState(false),
    [recovering, setRecovering] = useState(true);
  const [view, setView] = useState<{
    key: string;
    duels: ArenaDuel[];
    error: string;
    loaded: boolean;
  }>({ key: "", duels: [], error: "", loaded: false });
  useEffect(() => {
    gameRef.current = game;
    rewardRef.current = onReward;
  }, [game, onReward]);
  const invalidate = useCallback(() => {
    generation.current++;
    serial.current++;
    gate.enterSignedOut();
  }, [gate]);
  useEffect(() => {
    generation.current++;
    serial.current++;
    requests.current.clear();
    lock.current = false;
    blocked.current = true;
    if (demo) {
      gate.enterDemo();
      try {
        const saved = JSON.parse(
          localStorage.getItem(`arena-simulator:${game.id}`) ?? "null",
        );
        local.current =
          saved && Array.isArray(saved.duels) && saved.requests && saved.grants
            ? saved
            : emptyArena();
      } catch {
        local.current = emptyArena();
      }
      return invalidate;
    }
    gate.enterAccount(game.id);
    const { data } = browserClient().auth.onAuthStateChange(
      (event, session) => {
        if (
          event === "SIGNED_OUT" ||
          (session && session.user.id !== game.id)
        ) {
          gate.enterSignedOut();
          generation.current++;
          serial.current++;
          blocked.current = true;
          setView({ key: "", duels: [], error: "", loaded: false });
        }
      },
    );
    return () => {
      invalidate();
      data.subscription.unsubscribe();
    };
  }, [game.id, demo, gate, invalidate]);
  const rpc = useCallback(
    async <T>(name: string, p: Record<string, unknown> = {}): Promise<T> => {
      const ticket = gate.capture();
      if (demo) {
        if (!gate.isDemo()) throw Error("La session a changé.");
        const result = demoArenaRpc(local.current, gameRef.current, name, p);
        try {
          localStorage.setItem(
            `arena-simulator:${game.id}`,
            JSON.stringify(local.current),
          );
        } catch {}
        return structuredClone(result) as T;
      }
      if (!gate.isAccount(game.id)) throw Error("La session a changé.");
      const db = browserClient();
      const { data: auth, error: sessionError } = await db.auth.getSession();
      if (sessionError || !auth.session)
        throw Error("Reconnecte-toi pour continuer.");
      const token = auth.session.access_token;
      const { data: verified, error } = await db.auth.getUser(token);
      if (error || verified.user?.id !== game.id || !gate.isCurrent(ticket))
        throw Error("La session a changé.");
      const reply = await db
        .rpc(name, p)
        .setHeader("Authorization", `Bearer ${token}`);
      if (!gate.isCurrent(ticket) || !gate.isAccount(game.id))
        throw Error("La session a changé.");
      if (reply.error) {
        if (["PGRST202", "42883"].includes(reply.error.code))
          throw Error(
            "L’arène sera disponible après la mise à jour du jeu (migration 021).",
          );
        throw Error(
          reply.error.code === "P0001"
            ? reply.error.message
            : "Connexion interrompue. Actualise le duel avant de rejouer.",
        );
      }
      return reply.data as T;
    },
    [demo, game.id, gate],
  );
  const refresh = useCallback(async () => {
    const gen = generation.current,
      request = ++serial.current;
    try {
      const result = await rpc<{ duels: ArenaDuel[] }>("get_arena");
      let detailError = "";
      if (selectedId && !result.duels.some((d) => d.id === selectedId)) {
        try {
          result.duels.unshift(
            await rpc<ArenaDuel>("get_arena_duel", { p_duel_id: selectedId }),
          );
        } catch {
          detailError =
            "Ce duel est indisponible. Reviens à la liste pour retrouver tes combats.";
        }
      }
      if (gen === generation.current && request === serial.current) {
        blocked.current = false;
        setRecovering(false);
        setView({ key, duels: result.duels, error: detailError, loaded: true });
      }
      return result.duels;
    } catch (e) {
      if (gen === generation.current && request === serial.current) {
        blocked.current = true;
        setRecovering(true);
        setView((v) => ({
          key,
          duels: v.key === key ? v.duels : [],
          loaded: true,
          error: e instanceof Error ? e.message : "Arène indisponible.",
        }));
      }
      throw e;
    }
  }, [key, rpc, selectedId]);
  useEffect(() => {
    const tick = () => {
      if (active && !document.hidden && !lock.current)
        void refresh().catch(() => {});
    };
    const initial = setTimeout(tick, 0),
      timer = setInterval(tick, 10000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, refresh]);
  const finished = useRef(new Set<string>());
  useEffect(() => {
    for (const d of view.duels) {
      if (
        d.status === "finished" &&
        d.winner_id === game.id &&
        d.reward > 0 &&
        !finished.current.has(d.id)
      ) {
        finished.current.add(d.id);
        if (!demo) rewardRef.current();
      }
    }
  }, [view.duels, game.id, demo]);
  const mutate = async (name: string, p: Record<string, unknown>) => {
    if (lock.current || blocked.current) return null;
    lock.current = true;
    setBusy(true);
    serial.current++;
    const gen = ++generation.current;
    try {
      const d = await rpc<ArenaDuel>(name, p);
      if (gen !== generation.current) return null;
      setView((v) => ({
        key,
        duels: [
          d,
          ...(v.key === key ? v.duels : []).filter((x) => x.id !== d.id),
        ],
        error: "",
        loaded: true,
      }));
      return d;
    } catch (e) {
      if (gen === generation.current) {
        blocked.current = true;
        setRecovering(true);
        try {
          await refresh();
        } catch {}
        if (gen === generation.current)
          setView((v) => ({
            ...v,
            error:
              e instanceof Error
                ? e.message
                : "Action interrompue. Actualise avant de rejouer.",
          }));
      }
      return null;
    } finally {
      if (gen === generation.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  };
  const invite = async (friend: string) => {
    const storage = `arena-invite:${key}:${friend}`;
    let request = requests.current.get(friend);
    if (!request) {
      try {
        request = sessionStorage.getItem(storage) ?? undefined;
      } catch {}
      if (!request || !/^[a-f0-9-]{36}$/.test(request))
        request = crypto.randomUUID();
      requests.current.set(friend, request);
      try {
        sessionStorage.setItem(storage, request);
      } catch {}
    }
    const d = await mutate("arena_invite", {
      p_friend_id: friend,
      p_request_id: request,
    });
    if (d) {
      requests.current.delete(friend);
      try {
        sessionStorage.removeItem(storage);
      } catch {}
    }
    return d;
  };
  return {
    duels: view.key === key ? view.duels : [],
    error: view.key === key ? view.error : "",
    loaded: view.key === key && view.loaded,
    busy,
    recovering,
    refresh,
    mutate,
    invite,
  };
}
