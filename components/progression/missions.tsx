"use client";

import { useId, useRef, useState } from "react";
import { Check, Star } from "lucide-react";
import { MISSION_DEFINITIONS } from "@/lib/progression/metadata";
import type { MissionCode, MissionsProps } from "@/lib/progression/types";
import "./progression.css";

const parisDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});
const parisDeadline = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export function Missions({ progression, rpc, changed, demo }: MissionsProps) {
  const id = useId();
  const lock = useRef(false);
  const [busy, setBusy] = useState<MissionCode | null>(null);
  const [failure, setFailure] = useState<{
    code: MissionCode;
    message: string;
  } | null>(null);
  const selectedCount = progression.missions.filter(
    (mission) => mission.selected,
  ).length;

  async function choose(code: MissionCode) {
    if (lock.current) return;
    lock.current = true;
    setBusy(code);
    setFailure(null);
    try {
      await rpc("choose_weekly_mission", { p_code: code });
      await changed();
    } catch (caught) {
      setFailure({
        code,
        message:
          caught instanceof Error
            ? caught.message
            : "Cette mission n’a pas pu être choisie. Réessaie pour retrouver ton choix.",
      });
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  return (
    <section
      className="progression-missions"
      aria-labelledby={id}
      aria-busy={busy !== null}
    >
      <div className="progression-heading">
        <div>
          <p className="eyebrow">À TON RYTHME</p>
          <h2 id={id}>Tes missions de la semaine</h2>
        </div>
        <Star size={24} aria-hidden="true" />
      </div>
      <div className="progression-level">
        <strong>Niveau {progression.level}</strong>
        <span>{progression.xp} XP au total</span>
        <progress
          max={100}
          value={progression.xp % 100}
          aria-label="Progression vers le prochain niveau"
        />
        <small>
          {progression.xp % 100} / 100 XP vers le niveau {progression.level + 1}
        </small>
      </div>
      <p className="progression-intro">
        Choisis jusqu’à 3 missions parmi 5. Chaque mission accomplie rapporte 50
        XP, jusqu’à 150 XP par semaine.
      </p>
      <p className="progression-note">
        Choix définitif pour cette semaine. Tes bonnes actions déjà déclarées
        cette semaine comptent aussi.
      </p>
      <div className="progression-week">
        <span>
          Depuis le {parisDate.format(new Date(progression.week_start))}
        </span>
        <strong>
          {selectedCount} / 3 choisies · {progression.week_xp} / 150 XP
        </strong>
      </div>
      <p className="progression-note">
        Fin :{" "}
        <time dateTime={progression.week_end}>
          {parisDeadline.format(new Date(progression.week_end))}
        </time>{" "}
        (heure de Paris).
      </p>
      <div className="mission-list">
        {MISSION_DEFINITIONS.map((definition) => {
          const mission = progression.missions.find(
            (item) => item.code === definition.code,
          );
          if (!mission) return null;
          return (
            <article
              key={mission.code}
              className={`mission-card${mission.selected ? " mission-selected" : ""}${mission.awarded ? " mission-awarded" : ""}`}
            >
              <div className="mission-heading">
                <h3>{definition.label}</h3>
                <span className="mission-xp">
                  {mission.awarded && <Check size={13} aria-hidden="true" />}50
                  XP
                </span>
              </div>
              <p>{definition.description}</p>
              {mission.selected ? (
                <>
                  <div className="mission-status">
                    <span>
                      {mission.awarded
                        ? "Accomplie · XP reçus"
                        : mission.completed
                          ? "Accomplie · attribution en cours"
                          : "En cours"}
                    </span>
                    <strong>
                      {Math.min(mission.progress, mission.target)} /{" "}
                      {mission.target}
                    </strong>
                  </div>
                  <progress
                    max={mission.target}
                    value={Math.min(mission.progress, mission.target)}
                    aria-label={`Progression : ${definition.label}`}
                  />
                </>
              ) : (
                <button
                  type="button"
                  className="mission-choose"
                  disabled={
                    busy !== null || selectedCount >= 3 || !mission.available
                  }
                  onClick={() => void choose(mission.code)}
                >
                  {busy === mission.code
                    ? "Choix en cours…"
                    : !mission.available
                      ? "Aucune compétition cette semaine"
                      : selectedCount >= 3
                        ? "Tes 3 missions sont choisies"
                        : "Choisir cette mission"}
                </button>
              )}
            </article>
          );
        })}
      </div>
      {busy && (
        <p className="progression-note" role="status">
          Enregistrement de ta mission…
        </p>
      )}
      {failure && (
        <div className="progression-error" role="alert">
          <p>{failure.message}</p>
          <button
            className="progression-retry"
            type="button"
            disabled={busy !== null}
            onClick={() => void choose(failure.code)}
          >
            Réessayer ce choix
          </button>
        </div>
      )}
      {progression.badges.some((badge) => badge.id === "premier_trio") && (
        <p className="progression-earned">
          <Star size={17} aria-hidden="true" />
          Badge Premier trio obtenu
        </p>
      )}
      <p className="progression-note">
        Les XP débloquent ton apparence. Ils ne modifient pas tes minutes de
        vie.
      </p>
      {demo && (
        <p className="progression-demo">
          Démo · missions et récompenses fictives, enregistrées sur cet
          appareil.
        </p>
      )}
    </section>
  );
}
