"use client";
import { Crown, Trophy } from "lucide-react";
import { promotionCount, signed, type GameState } from "@/lib/game";
import { PlayerIdentity } from "./progression/player-identity";
import type { PlayerLook } from "@/lib/progression/types";
import { COSMETICS } from "@/lib/progression/metadata";

export function Leaderboard({
  state,
  looks = {},
}: {
  state: GameState;
  looks?: Record<string, PlayerLook>;
}) {
  const sorted = [...state.players].sort(
    (a, b) => b.weekly_score - a.weekly_score || a.id.localeCompare(b.id),
  );
  const movement = promotionCount(sorted.length);
  return (
    <div className="leaderboard">
      {sorted.length ? (
        sorted.map((p, index) => (
          <div
            key={p.id}
            className={"leader-row " + (p.id === state.id ? "is-you" : "")}
          >
            <span
              className={
                "rank " +
                (index < movement
                  ? "lime"
                  : index >= sorted.length - movement
                    ? "coral"
                    : "")
              }
            >
              {index === 0 ? <Crown size={19} /> : index + 1}
            </span>
            <div className="mini-avatar">
              <PlayerIdentity variant={p.avatar} look={looks[p.id]} />
            </div>
            <span className="leader-name">
              <strong>{p.id === state.id ? "Toi" : p.nickname}</strong>
              {p.id === state.id && <small>{state.nickname}</small>}
              {looks[p.id]?.equipped.title && (
                <small>
                  {
                    COSMETICS.find((c) => c.id === looks[p.id].equipped.title)
                      ?.label
                  }
                </small>
              )}
            </span>
            <b>{signed(p.weekly_score)}</b>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <Trophy size={32} />
          <p>Ta ligue t’attend.</p>
        </div>
      )}
    </div>
  );
}
