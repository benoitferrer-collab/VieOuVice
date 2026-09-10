"use client";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Clock3 } from "lucide-react";
import {
  formatLifeValue,
  type LifeStats,
  type TimeUnit,
} from "@/lib/life-time";
export function LifeTimeSummary({ stats }: { stats: LifeStats }) {
  const [unit, setUnit] = useState<TimeUnit>("auto");
  return (
    <section
      className="life-time-summary"
      aria-label="Ton temps de vie fictif depuis l’inscription"
    >
      <p className="survival-caption">TES EXCÈS CUMULÉS</p>
      <div className="life-time-total">
        {formatLifeValue(stats.lost_minutes, unit)}
      </div>
      <p className="life-time-subtitle">
        de vie fictive perdue depuis ton inscription
      </p>
      <label className="life-time-unit">
        <Clock3 size={14} /> Afficher en
        <select
          value={unit}
          onChange={(event) => setUnit(event.target.value as TimeUnit)}
        >
          <option value="auto">Durée détaillée</option>
          <option value="minutes">Minutes</option>
          <option value="hours">Heures</option>
          <option value="years">Années</option>
        </select>
      </label>
      <div className="life-time-details">
        <div>
          <ArrowUpRight size={18} />
          <span>Bonnes habitudes</span>
          <strong>{formatLifeValue(stats.recovered_minutes, unit)}</strong>
          <small>récupérées dans le jeu</small>
        </div>
        <div
          className={stats.net_lost_minutes < 0 ? "net-recovered" : "net-lost"}
        >
          <ArrowDownRight size={18} />
          <span>Bilan net</span>
          <strong>{formatLifeValue(stats.net_lost_minutes, unit)}</strong>
          <small>
            {stats.net_lost_minutes < 0
              ? "récupérées au total"
              : stats.net_lost_minutes === 0
                ? "à l’équilibre"
                : "perdues après récupération"}
          </small>
        </div>
      </div>
      <p className="fine-print">
        Bilan net = pertes − récupérations. Bonus, dons et XP exclus.{" "}
        {unit === "years"
          ? "Conversion arrondie, sur une année de 365 jours."
          : "Année de jeu : 365 jours."}
      </p>
    </section>
  );
}
