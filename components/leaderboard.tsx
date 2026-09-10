"use client";
import { Crown, Trophy } from "lucide-react";
import { promotionCount, signed, type GameState } from "@/lib/game";
import { PlayerIdentity } from "./progression/player-identity";
import type { PlayerLook } from "@/lib/progression/types";
import { COSMETICS } from "@/lib/progression/metadata";
import {
  formatLifeDuration,
  lossScore,
  rankByLoss,
  type LossRanking,
} from "@/lib/life-time";

export function Leaderboard({
  state,
  looks = {},
  mode = "gross",
}: {
  state: GameState;
  looks?: Record<string, PlayerLook>;
  mode?: LossRanking;
}) {
  const sorted = state.loss_scoring
    ? rankByLoss(state.players, mode)
    : [...state.players].sort(
        (a, b) => b.weekly_score - a.weekly_score || a.id.localeCompare(b.id),
      );
  const leagueSize = state.league_size ?? sorted.length;
  const movement =
    state.loss_scoring && mode === "net" ? 0 : promotionCount(leagueSize);
  return (
    <div className="leaderboard">
      {sorted.length ? (
        sorted.map((p, index) => {
          const position =
            state.loss_scoring && mode === "gross"
              ? (p.official_rank ?? index + 1)
              : index + 1;
          return (
            <div
              key={p.id}
              className={"leader-row " + (p.id === state.id ? "is-you" : "")}
            >
              <span
                className={
                  "rank " +
                  (position <= movement
                    ? "lime"
                    : position > leagueSize - movement
                      ? "coral"
                      : "")
                }
              >
                {position === 1 ? <Crown size={19} /> : position}
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
              {state.loss_scoring ? (
                <b className="loss-score">
                  <span>{formatLifeDuration(lossScore(p, mode))}</span>
                  <small>
                    {lossScore(p, mode) < 0 ? "récupérées" : "perdues"}
                  </small>
                </b>
              ) : (
                <b>{signed(p.weekly_score)}</b>
              )}
            </div>
          );
        })
      ) : (
        <div className="empty-state">
          <Trophy size={32} />
          <p>Ta ligue t’attend.</p>
        </div>
      )}
    </div>
  );
}
