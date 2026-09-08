"use client";
import { Crown, Trophy } from "lucide-react";
import { promotionCount, signed, type GameState } from "@/lib/game";
import { Reaper } from "./avatar";

export function Leaderboard({ state }: { state: GameState }) {
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
              <Reaper variant={p.avatar} />
            </div>
            <span className="leader-name">
              <strong>{p.id === state.id ? "Toi" : p.nickname}</strong>
              {p.id === state.id && <small>{state.nickname}</small>}
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
