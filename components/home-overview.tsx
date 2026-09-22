"use client";

import { ArrowRight, Flame, Leaf, Shield, Swords, Trophy } from "lucide-react";
import type { GameState } from "@/lib/game";
import type { ProgressionState } from "@/lib/progression/types";
import { COSMETICS } from "@/lib/progression/metadata";
import { formatLifeDuration } from "@/lib/life-time";
import { Reaper } from "./avatar";
import { NextAccessory } from "./progression/next-accessory";
import { LifeTimeSummary } from "./life-time-summary";

export function HomeOverview({
  state,
  progression,
  onDeclare,
  onArena,
  onLeague,
  onWardrobe,
  onPreviewAccessory,
}: {
  state: GameState;
  progression: ProgressionState | null;
  onDeclare: (kind: "health" | "excess") => void;
  onArena: () => void;
  onLeague: () => void;
  onWardrobe: () => void;
  onPreviewAccessory: (id: string) => void;
}) {
  const title =
    COSMETICS.find((c) => c.id === progression?.equipped.title)?.label ??
    "La faucheuse attendra.";
  return (
    <div className="home-overview">
      <section className="v2-hero" aria-label="Ton personnage">
        <div className="v2-hero-copy">
          <span className="eyebrow">TON PERSONNAGE</span>
          <p className="v2-level-label">
            Niveau <strong>{progression?.level ?? "—"}</strong>
          </p>
          <h2>{title}</h2>
          {progression && (
            <div className="v2-xp">
              <progress
                max={100}
                value={progression.xp % 100}
                aria-label="Progression vers le prochain niveau"
              />
              <span>
                {progression.xp % 100} / 100 XP vers le niveau{" "}
                {progression.level + 1}
              </span>
            </div>
          )}
          <button
            className="v2-customize"
            onClick={onWardrobe}
            disabled={!progression}
          >
            Personnaliser <ArrowRight size={14} />
          </button>
        </div>
        <div className="v2-hero-avatar">
          <Reaper
            variant={state.avatar}
            cosmetics={progression?.equipped}
            large
          />
        </div>
      </section>
      {progression && (
        <NextAccessory
          progression={progression}
          variant={state.avatar}
          onPreview={onPreviewAccessory}
        />
      )}
      {state.life_stats ? (
        <>
          <div className="v2-time-grid">
            <div className="v2-time-lost">
              <span>
                <Flame size={16} /> Temps perdu
              </span>
              <strong>
                −{formatLifeDuration(state.life_stats.lost_minutes)}
              </strong>
            </div>
            <div className="v2-time-gained">
              <span>
                <Leaf size={16} /> Temps gagné
              </span>
              <strong>
                +{formatLifeDuration(state.life_stats.recovered_minutes)}
              </strong>
            </div>
          </div>
          <details className="v2-time-details">
            <summary>Voir le bilan et changer d’unité</summary>
            <LifeTimeSummary stats={state.life_stats} />
          </details>
        </>
      ) : (
        <div className="v2-capital">
          <span>Ton capital de jeu</span>
          <strong>
            {new Intl.NumberFormat("fr-FR").format(state.balance)}{" "}
            <small>min</small>
          </strong>
        </div>
      )}
      <p className="v2-disclaimer">
        <Shield size={12} /> Compteurs ludiques et fictifs
      </p>
      <div className="v2-declare" aria-label="Déclarer une action">
        <button onClick={() => onDeclare("health")}>
          <Leaf size={19} />
          <span>Bonne habitude</span>
          <b>+</b>
        </button>
        <button onClick={() => onDeclare("excess")}>
          <Flame size={19} />
          <span>Petit écart</span>
          <b>+</b>
        </button>
      </div>
      <div className="section-heading">
        <h2>Explorer le jeu</h2>
        <span className="muted small">Entre amis</span>
      </div>
      <div className="v2-shortcuts">
        <button onClick={onArena}>
          <span className="v2-shortcut-icon">
            <Swords size={23} />
          </span>
          <span>
            <strong>Entre dans l’arène</strong>
            <small>Un ami. Quatre actions. Ton duel.</small>
          </span>
          <ArrowRight size={17} />
        </button>
        <button onClick={onLeague}>
          <span className="v2-shortcut-icon gold">
            <Trophy size={23} />
          </span>
          <span>
            <strong>Ta ligue</strong>
            <small>Classement et saison en cours</small>
          </span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
