import { Flame, Leaf, Medal, Star, Trophy } from "lucide-react";
import { COSMETICS } from "@/lib/progression/metadata";
import type { PlayerLook } from "@/lib/progression/types";
import { Reaper } from "../avatar";
import "./progression.css";

const badgeIcons = {
  flame: Flame,
  leaf: Leaf,
  medal: Medal,
  star: Star,
  trophy: Trophy,
};

export function PlayerIdentity({
  look,
  variant,
  nickname,
  large = false,
  showName = false,
}: {
  look?: PlayerLook;
  variant: number;
  nickname?: string;
  large?: boolean;
  showName?: boolean;
}) {
  const title = COSMETICS.find(
    (item) => item.slot === "title" && item.id === look?.equipped.title,
  );
  return (
    <span
      className={`player-identity${large ? " player-identity-large" : ""}${showName ? " player-identity-full" : ""}`}
    >
      <span className="player-identity-avatar">
        <Reaper variant={variant} large={large} cosmetics={look?.equipped} />
        {!!look?.badges.length && (
          <span className="player-identity-badges">
            {look.badges.slice(0, 3).map((badge) => {
              const Icon = badgeIcons[badge.icon] ?? Medal;
              return (
                <span
                  key={badge.id}
                  className="player-identity-badge"
                  title={badge.label}
                  role="img"
                  aria-label={badge.label}
                >
                  <Icon size={large ? 16 : 10} aria-hidden="true" />
                </span>
              );
            })}
          </span>
        )}
      </span>
      {showName && (
        <span className="player-identity-copy">
          <strong>{nickname}</strong>
          {title && (
            <small className="player-identity-title">{title.label}</small>
          )}
          {look && <small>Niveau {look.level}</small>}
        </span>
      )}
    </span>
  );
}
