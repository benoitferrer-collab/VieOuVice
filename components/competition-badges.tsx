import { Trophy, Medal, Leaf, Flame } from "lucide-react";
import type { CompetitionBadge } from "@/lib/events/types";
const icons = { trophy: Trophy, medal: Medal, leaf: Leaf, flame: Flame };
export function CompetitionBadges({ badges }: { badges: CompetitionBadge[] }) {
  return (
    <section className="competition-badges">
      <div className="section-heading">
        <h2>Mes badges de compétition</h2>
        <span className="count-badge">{badges.length}</span>
      </div>
      {badges.length ? (
        <div className="competition-badge-list">
          {badges.map((b) => {
            const Icon = icons[b.icon] || Medal;
            return (
              <article key={b.event_id} className="competition-badge">
                <Icon
                  size={28}
                  className={b.kind === "winner" ? "amber" : "lime"}
                />
                <div>
                  <strong>{b.label}</strong>
                  <small>{b.event_title}</small>
                  <span>
                    {b.kind === "winner"
                      ? "Victoire"
                      : b.kind === "podium"
                        ? "Podium"
                        : "Participation"}{" "}
                    · rang {b.rank}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="muted">
          Tes récompenses apparaîtront ici après les compétitions auxquelles tu
          participes.
        </p>
      )}
    </section>
  );
}
