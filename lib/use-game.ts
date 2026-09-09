"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { browserClient } from "./supabase/browser";
import {
  applyDemoAction,
  makeDemo,
  type GameState,
  type CatalogItem,
  type Notice,
  type SocialSettings,
} from "./game";
import { recoveredImpact } from "./intent";
import { createDemoCatalogItem } from "./community";
import {
  communityActionSchema,
  type CommunityActionInput,
} from "./validation/community";
import { socialNotice } from "./notifications";
import { actionSchema } from "./validation/schemas";
import { GameSessionGate } from "./game-session";
const STORAGE = "exces-o-meter:demo:v1";
export function useGame(configured: boolean) {
  const [liveNotice, setLiveNotice] = useState<Notice | null>(null);
  const seenNotices = useRef(new Set<string>());
  const [state, setState] = useState<GameState | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const current = useRef<GameState | null>(null);
  const [session] = useState(() => new GameSessionGate());
  const loadSequence = useRef(0);
  const clearGame = useCallback(() => {
    current.current = null;
    setState(null);
    setAuthenticated(false);
    setNeedsProfile(false);
    setLiveNotice(null);
    seenNotices.current.clear();
  }, []);
  const update = useCallback((value: GameState) => {
    const normalized = {
      ...value,
      community_enabled: value.community_enabled ?? value.id === "demo-you",
      social_settings: value.social_settings ?? {
        share_activity: false,
        notify_friends: true,
        notify_duels: true,
      },
    };
    current.current = normalized;
    setState(normalized);
  }, []);
  const load = useCallback(async () => {
    if (!configured || session.isDemo()) return;
    let ticket = session.capture();
    const request = ++loadSequence.current;
    const valid = () =>
      session.isCurrent(ticket) && request === loadSequence.current;
    const db = browserClient();
    try {
      const { data: auth, error: authError } = await db.auth.getUser();
      if (!valid()) return;
      if (authError || !auth.user) {
        session.enterSignedOut();
        clearGame();
        setLoading(false);
        return;
      }
      if (!session.isAccount(auth.user.id)) clearGame();
      ticket = session.enterAccount(auth.user.id);
      setAuthenticated(true);
      const result = await session.load<GameState>(ticket, auth.user.id, () =>
        db.rpc("get_game_state"),
      );
      if (!valid() || result.status === "stale") return;
      if (result.status === "identity-mismatch") {
        clearGame();
        throw new Error(
          "La session a changé. Reconnecte-toi pour retrouver ta partie.",
        );
      }
      if (result.status === "error")
        throw new Error(
          "Impossible de charger la partie. Vérifiez la connexion et l’installation Supabase.",
        );
      if (result.status !== "loaded") return;
      if (!result.data) {
        current.current = null;
        setState(null);
        setNeedsProfile(true);
        return;
      }
      setNeedsProfile(false);
      update(result.data);
    } catch (caught) {
      if (valid()) throw caught;
    }
  }, [configured, update, session, clearGame]);
  useEffect(() => {
    let active = true;
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    async function init() {
      try {
        if (!configured) {
          let saved;
          try {
            saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
          } catch {}
          if (active) {
            session.enterDemo();
            setDemo(true);
            update(
              saved?.id === "demo-you" && Array.isArray(saved.actions)
                ? saved
                : makeDemo(),
            );
          }
        } else await load();
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Chargement impossible.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void init();
    return () => {
      active = false;
      session.enterSignedOut();
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [configured, load, update, session]);
  useEffect(() => {
    if (demo && state)
      try {
        localStorage.setItem(STORAGE, JSON.stringify(state));
      } catch {
        /* private browsing may disable storage */
      }
  }, [state, demo]);
  useEffect(() => {
    if (!configured || demo || !authenticated || !state?.id) return;
    const ticket = session.capture();
    const db = browserClient();
    const refresh = () => {
      if (!session.isCurrent(ticket)) return;
      void load().catch(
        () =>
          session.isCurrent(ticket) &&
          setError(
            "Connexion interrompue. Actualise pour retrouver ta partie.",
          ),
      );
    };
    const channel = db
      .channel("game-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${current.current?.id}`,
        },
        (payload) => {
          if (!session.isCurrent(ticket)) return;
          const notice =
            payload.eventType === "INSERT" ? socialNotice(payload.new) : null;
          if (notice && !seenNotices.current.has(notice.id)) {
            seenNotices.current.add(notice.id);
            if (seenNotices.current.size > 200)
              seenNotices.current.delete(
                seenNotices.current.values().next().value!,
              );
            setLiveNotice(notice);
          }
          refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leaderboard_entries" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "action_catalog" },
        refresh,
      )
      .subscribe();
    window.addEventListener("online", refresh);
    return () => {
      void db.removeChannel(channel);
      window.removeEventListener("online", refresh);
    };
  }, [configured, demo, authenticated, load, session, state?.id]);
  useEffect(() => {
    if (!configured) return;
    const {
      data: { subscription },
    } = browserClient().auth.onAuthStateChange((event, auth) => {
      if (event === "SIGNED_OUT") {
        session.enterSignedOut();
        clearGame();
        setDemo(false);
        setLoading(false);
        setError("");
      }
      if (event === "SIGNED_IN" && auth?.user) {
        if (!session.isAccount(auth.user.id)) {
          session.enterAccount(auth.user.id);
          clearGame();
          setDemo(false);
        }
        const ticket = session.capture();
        window.setTimeout(() => {
          if (!session.isCurrent(ticket)) return;
          void load()
            .catch(() => {
              if (session.isCurrent(ticket))
                setError("Chargement impossible. Réessaie.");
            })
            .finally(() => {
              if (session.isCurrent(ticket)) setLoading(false);
            });
        }, 0);
      }
    });
    return () => subscription.unsubscribe();
  }, [configured, load, session, clearGame]);
  const startDemo = () => {
    session.enterDemo();
    clearGame();
    setDemo(true);
    setError("");
    update(makeDemo());
    setLoading(false);
  };
  async function record(item: CatalogItem, quantity: number, key: string) {
    const intent = actionSchema.parse({
      p_catalog_id: item.id,
      p_quantity: quantity,
      p_idempotency_key: key,
    });
    if (demo) {
      const before = current.current!;
      const next = applyDemoAction(before, item, quantity, key);
      update(next);
      return next.actions.find((a) => a.idempotency_key === key)!
        .minutes_impact;
    }
    if (!navigator.onLine)
      throw new Error(
        "Hors connexion. Ton brouillon est conservé ; confirme-le après reconnexion.",
      );
    const db = browserClient();
    const ticket = session.capture();
    const assertSession = () => {
      if (!session.isCurrent(ticket))
        throw new Error("La session a changé. Reconnecte-toi pour continuer.");
    };
    const { data, error: rpcError } = await db.rpc("record_action", intent);
    assertSession();
    if (rpcError) {
      const { data: existing } = await db
        .from("actions")
        .select("catalog_id,quantity,minutes_impact")
        .eq("idempotency_key", key)
        .maybeSingle();
      assertSession();
      if (existing) {
        const impact = recoveredImpact(existing, item.id, quantity);
        await load();
        assertSession();
        return impact;
      }
      throw new Error(
        rpcError.message.includes("Quantité")
          ? "Quantité non autorisée."
          : "Connexion interrompue. Aucun mouvement confirmé. Réessaie avec ce même brouillon.",
      );
    }
    await load();
    assertSession();
    return data.minutes_impact as number;
  }
  async function mutate(name: string, payload: Record<string, unknown>) {
    if (demo) throw new Error("Cette opération nécessite un compte connecté.");
    if (!navigator.onLine)
      throw new Error("Hors connexion. Réessaie après reconnexion.");
    const ticket = session.capture();
    const { data, error: rpcError } = await browserClient().rpc(name, payload);
    if (!session.isCurrent(ticket))
      throw new Error("La session a changé. Reconnecte-toi pour continuer.");
    if (rpcError)
      throw new Error(rpcError.message || "Opération non confirmée.");
    await load();
    if (!session.isCurrent(ticket))
      throw new Error("La session a changé. Reconnecte-toi pour continuer.");
    return data;
  }
  async function createCatalog(input: CommunityActionInput) {
    const parsed = communityActionSchema.parse(input);
    if (demo) {
      const result = createDemoCatalogItem(current.current!, parsed);
      update(result.state);
      return result.item;
    }
    return (await mutate("create_catalog_action", parsed)) as CatalogItem;
  }
  async function saveSocialSettings(settings: SocialSettings) {
    if (demo) {
      if (current.current)
        update({ ...current.current, social_settings: settings });
      return;
    }
    await mutate("update_notification_settings", {
      p_share_activity: settings.share_activity,
      p_notify_friends: settings.notify_friends,
      p_notify_duels: settings.notify_duels,
    });
  }
  function localPatch(patch: Partial<GameState>) {
    if (demo && current.current) update({ ...current.current, ...patch });
  }
  async function readNotice(id: string) {
    if (demo && current.current) {
      localPatch({
        notifications: current.current.notifications.map((notice) =>
          notice.id === id && !notice.read_at
            ? { ...notice, read_at: new Date().toISOString() }
            : notice,
        ),
      });
    } else if (current.current?.community_enabled) {
      await mutate("read_notification", { p_id: id });
    }
  }
  async function signOut() {
    const ticket = session.enterSignedOut();
    clearGame();
    setError("");
    setLoading(false);
    if (demo) {
      if (configured) {
        setDemo(false);
        setState(null);
        current.current = null;
        await load();
      } else {
        session.enterDemo();
        update(makeDemo());
      }
    } else {
      const { error: signOutError } = await browserClient().auth.signOut();
      if (signOutError && session.isCurrent(ticket))
        setError("Déconnexion non confirmée. Réessaie.");
    }
  }
  return {
    state,
    demo,
    loading,
    error,
    online,
    authenticated,
    needsProfile,
    startDemo,
    record,
    mutate,
    localPatch,
    signOut,
    createCatalog,
    saveSocialSettings,
    liveNotice,
    readNotice,
    refresh: async () => {
      const ticket = session.capture();
      setError("");
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (session.isCurrent(ticket))
          setError(e instanceof Error ? e.message : "Chargement impossible.");
      } finally {
        if (session.isCurrent(ticket)) setLoading(false);
      }
    },
  };
}
