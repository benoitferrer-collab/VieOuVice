"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, LockKeyhole, Users } from "lucide-react";
import { Sheet } from "./sheet";
import { EncouragementList } from "./progression/encouragement-list";
import { PlayerIdentity } from "./progression/player-identity";
import type { PlayerLook } from "@/lib/progression/types";
import { signed, type Friend } from "@/lib/game";
import type {
  FriendActivityPage,
  HubRpc,
  SharedAction,
} from "@/lib/events/types";
export function FriendActivity({
  friend,
  rpc,
  onClose,
  demo,
  encouragementRpc,
  look,
}: {
  friend: Friend;
  rpc: HubRpc;
  onClose: () => void;
  demo: boolean;
  encouragementRpc?: HubRpc;
  look?: PlayerLook;
}) {
  const [page, setPage] = useState<FriendActivityPage | null>(null);
  const [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const [kind, setKind] = useState<"all" | "health" | "excess">("all");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    rpc<FriendActivityPage>("get_friend_activity", {
      p_friend_id: friend.id,
      p_limit: 50,
    })
      .then((data) => {
        if (alive.current) setPage(data);
      })
      .catch((e) => {
        if (alive.current)
          setError(e instanceof Error ? e.message : "Historique inaccessible.");
      })
      .finally(() => {
        if (alive.current) setBusy(false);
      });
    return () => {
      alive.current = false;
    };
  }, [friend.id, rpc]);
  const actions = (page?.actions || []).filter(
    (a) => kind === "all" || a.kind === kind,
  );
  async function more() {
    if (busy || !page?.next_cursor) return;
    setBusy(true);
    setError("");
    try {
      const next = await rpc<FriendActivityPage>("get_friend_activity", {
        p_friend_id: friend.id,
        p_limit: 50,
        p_before: page.next_cursor.created_at,
        p_before_id: page.next_cursor.id,
      });
      if (alive.current)
        setPage((old) =>
          next.shared
            ? {
                ...next,
                actions: [...(old?.actions || []), ...next.actions].filter(
                  (a, i, all) => all.findIndex((x) => x.id === a.id) === i,
                ),
              }
            : next,
        );
    } catch (e) {
      if (alive.current) {
        setPage(null);
        setError(e instanceof Error ? e.message : "Historique inaccessible.");
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Sheet title={`La semaine de ${friend.nickname}`} onClose={onClose}>
      {look && (
        <PlayerIdentity
          look={look}
          variant={friend.avatar}
          nickname={friend.nickname}
          showName
        />
      )}
      <p className="muted">
        Les déclarations partagées des sept derniers jours.
      </p>
      {demo && <p className="notice">Historique fictif de démonstration.</p>}
      {error && (
        <p role="alert" className="coral">
          {error}
        </p>
      )}
      {page && !page.shared ? (
        <div className="empty-state">
          <LockKeyhole size={32} />
          <h3>Un journal encore privé.</h3>
          <p>
            {friend.nickname} peut partager ses sept derniers jours dans ses
            préférences.
          </p>
        </div>
      ) : (
        page && (
          <>
            <div
              className="catalog-filters"
              aria-label="Filtrer l’historique affiché"
            >
              {(
                [
                  ["all", "Toutes"],
                  ["health", "Bonnes actions"],
                  ["excess", "Petits écarts"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={kind === value ? "active" : ""}
                  aria-pressed={kind === value}
                  onClick={() => setKind(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="friend-history">
              {actions.length ? (
                encouragementRpc ? (
                  <EncouragementList
                    ids={actions.map((a) => a.id)}
                    rpc={encouragementRpc}
                  >
                    {(render) =>
                      actions.map((a) => (
                        <div key={a.id}>
                          <HistoryRow action={a} />
                          {render(a.id)}
                        </div>
                      ))
                    }
                  </EncouragementList>
                ) : (
                  actions.map((a) => <HistoryRow key={a.id} action={a} />)
                )
              ) : (
                <div className="empty-state">
                  <Users size={30} />
                  <p>Aucune action dans cette sélection.</p>
                </div>
              )}
            </div>
            <p className="fine-print">
              {page.actions.length} déclaration(s) chargée(s).{" "}
              {page.next_cursor
                ? "Il reste des actions à consulter."
                : "Fin de l’historique disponible sur sept jours."}
            </p>
            {page.next_cursor && (
              <button
                className="secondary full"
                disabled={busy}
                onClick={() => void more()}
              >
                Charger la suite
              </button>
            )}
          </>
        )
      )}
      {busy && (
        <p role="status" className="muted">
          Chargement des actions…
        </p>
      )}
    </Sheet>
  );
}
function HistoryRow({ action: a }: { action: SharedAction }) {
  return (
    <div className="friend-history-row">
      <span className={a.kind === "health" ? "lime" : "coral"}>
        {a.kind === "health" ? (
          <ArrowUpRight size={20} />
        ) : (
          <ArrowDownLeft size={20} />
        )}
      </span>
      <div>
        <strong>{a.label}</strong>
        <small>
          {new Intl.DateTimeFormat("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(a.created_at))}{" "}
          · ×{a.quantity}
        </small>
      </div>
      <b className={a.minutes_impact >= 0 ? "lime" : "coral"}>
        {signed(a.minutes_impact)} min
      </b>
    </div>
  );
}
