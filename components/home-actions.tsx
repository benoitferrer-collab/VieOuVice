"use client";
import {
  ArrowRight,
  MessageCircle,
  Swords,
  Users,
  Target,
  CheckCircle2,
} from "lucide-react";
import type { GameState } from "@/lib/game";
import type { ProgressionState } from "@/lib/progression/types";
import type { MessageInbox } from "@/lib/messages/rules";
import { MISSION_DEFINITIONS } from "@/lib/progression/metadata";
import {
  homePriorities,
  ongoingMission,
  type HomePriority,
} from "@/lib/home/priorities";
import { useArena } from "@/lib/arena/use-arena";

export function HomeActions({
  game,
  demo,
  progression,
  inbox,
  messagesError,
  onOpen,
  onMissions,
  onReward,
}: {
  game: GameState;
  demo: boolean;
  progression: ProgressionState | null;
  inbox: MessageInbox | null;
  messagesError?: string;
  onOpen: (item: HomePriority) => void;
  onMissions: () => void;
  onReward: () => void;
}) {
  const arena = useArena(game, demo, true, null, onReward);
  const priorities = homePriorities(
    game,
    arena.error ? [] : arena.duels,
    messagesError ? null : inbox,
  );
  const mission = ongoingMission(progression);
  const definition = MISSION_DEFINITIONS.find((d) => d.code === mission?.code);
  const row = (item: HomePriority) => {
    const Icon =
      item.kind === "message"
        ? MessageCircle
        : item.kind === "friend"
          ? Users
          : Swords;
    return (
      <button
        key={`${item.kind}:${item.id}`}
        className={`home-priority priority-${item.kind}`}
        onClick={() => onOpen(item)}
      >
        <span className="home-priority-icon">
          <Icon size={20} />
        </span>
        <span>
          <strong>{item.label}</strong>
          <small>{item.detail}</small>
        </span>
        <ArrowRight size={17} />
      </button>
    );
  };
  return (
    <section className="home-next" aria-label="Tes prochaines actions">
      <div className="section-heading">
        <h2>À toi de jouer</h2>
        <span className="home-next-label">TA PARTIE</span>
      </div>
      {!arena.loaded && !arena.error && (
        <p className="home-next-status" role="status">
          Recherche de tes duels…
        </p>
      )}
      {arena.error && (
        <p className="home-next-status" role="status">
          Duels momentanément indisponibles.{" "}
          <button onClick={() => void arena.refresh().catch(() => {})}>
            Réessayer
          </button>
        </p>
      )}
      {(messagesError || !inbox) && (
        <p className="home-next-status">
          {messagesError
            ? "Messages momentanément indisponibles."
            : "Recherche de tes messages…"}
        </p>
      )}
      {priorities.slice(0, 3).map(row)}
      {priorities.length > 3 && (
        <details className="home-more">
          <summary>
            {priorities.length - 3} autre{priorities.length > 4 ? "s" : ""}{" "}
            action{priorities.length > 4 ? "s" : ""} en attente
          </summary>
          {priorities.slice(3).map(row)}
        </details>
      )}
      {!priorities.length &&
        arena.loaded &&
        !arena.error &&
        inbox &&
        !messagesError && (
          <p className="home-all-clear">
            <CheckCircle2 size={18} /> Tu es à jour. À ton rythme !
          </p>
        )}
      <button
        className="home-mission"
        disabled={!progression}
        onClick={onMissions}
      >
        <Target size={22} />
        <span>
          <small>MISSION DE LA SEMAINE</small>
          <strong>
            {definition?.label ??
              (!progression
                ? "Chargement de ta progression…"
                : progression.missions.some((m) => m.selected)
                  ? "Voir mes missions"
                  : "Choisir ma première mission")}
          </strong>
          {mission && (
            <>
              <progress
                max={mission.target}
                value={Math.min(mission.target, mission.progress)}
                aria-label={`Progression : ${definition?.label}`}
              />
              <small>
                {Math.min(mission.progress, mission.target)} / {mission.target}{" "}
                · récompense {mission.xp} XP
              </small>
            </>
          )}
        </span>
        <ArrowRight size={17} />
      </button>
    </section>
  );
}
