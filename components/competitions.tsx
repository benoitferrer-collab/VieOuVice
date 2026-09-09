"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Flame,
  Leaf,
  Medal,
  Trophy,
  Users,
} from "lucide-react";
import type {
  CompetitionDetail,
  CompetitionSummary,
  CompetitionsProps,
  HubRpc,
} from "@/lib/events/types";
import { competitionPhase } from "@/lib/events/rules";
import { PlayerIdentity } from "./progression/player-identity";
import { LookList } from "./progression/look-list";
import { COSMETICS } from "@/lib/progression/metadata";
import { Sheet } from "./sheet";
import "./events.css";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const scoreFormat = new Intl.NumberFormat("fr-FR");

const phaseLabels = {
  upcoming: "À venir",
  active: "En cours",
  ended: "Résultats en préparation",
  draft: "Brouillon",
  cancelled: "Annulée",
  completed: "Terminée",
} as const;

const metricLabels = {
  health_minutes: "Minutes positives",
  net_minutes: "Solde net de minutes",
  category_minutes: "Minutes de la catégorie choisie",
} as const;

function eventDates(event: CompetitionSummary) {
  return `${dateFormat.format(new Date(event.starts_at))} → ${dateFormat.format(new Date(event.ends_at))}`;
}

function EventIcon({ icon }: { icon: CompetitionSummary["badge_icon"] }) {
  const Icon = { trophy: Trophy, medal: Medal, leaf: Leaf, flame: Flame }[icon];
  return <Icon size={20} aria-hidden="true" />;
}

export function Competitions({
  events,
  demo,
  rpc,
  changed,
  appearanceRpc,
}: CompetitionsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedSummary = useMemo(
    () => events.find((event) => event.id === selectedId) ?? null,
    [events, selectedId],
  );

  async function loadDetail(eventId: string, offset = 0) {
    const page = await rpc<CompetitionDetail>("get_competition", {
      p_event_id: eventId,
      p_offset: offset,
    });
    setDetail((current) =>
      offset > 0 && current?.id === page.id
        ? {
            ...page,
            leaderboard: [...current.leaderboard, ...page.leaderboard],
          }
        : page,
    );
  }

  async function open(event: CompetitionSummary) {
    setSelectedId(event.id);
    setDetail(null);
    setError("");
    setLoading(true);
    try {
      await loadDetail(event.id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Le détail de la compétition est indisponible.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function changeRegistration(join: boolean) {
    if (!detail || mutationBusy) return;
    setMutationBusy(true);
    setError("");
    try {
      await rpc(join ? "join_competition" : "leave_competition", {
        p_event_id: detail.id,
      });
      await changed();
      await loadDetail(detail.id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "L’inscription n’a pas pu être modifiée.",
      );
    } finally {
      setMutationBusy(false);
    }
  }

  const visibleEvents = events.filter(
    (event) => event.status !== "draft" && event.status !== "cancelled",
  );

  return (
    <section className="events-section" aria-labelledby="events-title">
      <div className="events-heading">
        <div>
          <p className="eyebrow">DÉFIS COLLECTIFS</p>
          <h2 id="events-title">Compétitions</h2>
        </div>
        <Trophy size={22} aria-hidden="true" />
      </div>
      <p className="events-intro">
        Des défis limités dans le temps, avec un classement et un badge à la
        clé.
      </p>

      {visibleEvents.length === 0 ? (
        <div className="events-empty">
          <CalendarDays size={26} aria-hidden="true" />
          <p>Aucune compétition ouverte pour le moment.</p>
        </div>
      ) : (
        <div className="events-list">
          {visibleEvents.map((event) => {
            const phase = competitionPhase(event);
            return (
              <button
                type="button"
                className="events-card"
                key={event.id}
                onClick={() => void open(event)}
                aria-label={`Voir la compétition ${event.title}`}
              >
                <span className="events-card-icon">
                  <EventIcon icon={event.badge_icon} />
                </span>
                <span className="events-card-copy">
                  <span className={`events-phase events-phase-${phase}`}>
                    {phaseLabels[phase]}
                  </span>
                  <strong>{event.title}</strong>
                  <small>{eventDates(event)}</small>
                  <span className="events-card-meta">
                    <span>
                      <Users size={13} aria-hidden="true" />
                      {event.participant_count}
                    </span>
                    {event.joined && (
                      <span className="events-joined">Inscrit</span>
                    )}
                    {event.my_rank !== null && (
                      <span>
                        #{event.my_rank} ·{" "}
                        {scoreFormat.format(event.my_score ?? 0)} min
                      </span>
                    )}
                  </span>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      {selectedId && (
        <Sheet
          title={detail?.title ?? selectedSummary?.title ?? "Compétition"}
          onClose={() => {
            if (!mutationBusy && !moreBusy) {
              setSelectedId(null);
              setDetail(null);
              setError("");
            }
          }}
        >
          {loading ? (
            <div className="events-loading" role="status">
              <span className="loader" />
              Chargement du classement…
            </div>
          ) : detail ? (
            <CompetitionDetails
              appearanceRpc={appearanceRpc}
              detail={detail}
              demo={demo}
              error={error}
              mutationBusy={mutationBusy}
              moreBusy={moreBusy}
              onRegistration={changeRegistration}
              onMore={async () => {
                if (detail.next_offset === null || moreBusy) return;
                setMoreBusy(true);
                setError("");
                try {
                  await loadDetail(detail.id, detail.next_offset);
                } catch (caught) {
                  setError(
                    caught instanceof Error
                      ? caught.message
                      : "La suite du classement est indisponible.",
                  );
                } finally {
                  setMoreBusy(false);
                }
              }}
            />
          ) : (
            <div className="events-empty" role="alert">
              <p>{error || "Le détail de la compétition est indisponible."}</p>
              <button
                type="button"
                className="secondary"
                onClick={() => void open(selectedSummary!)}
                disabled={!selectedSummary}
              >
                Réessayer
              </button>
            </div>
          )}
        </Sheet>
      )}
    </section>
  );
}

function CompetitionDetails({
  detail,
  demo,
  error,
  mutationBusy,
  moreBusy,
  onRegistration,
  onMore,
  appearanceRpc,
}: {
  detail: CompetitionDetail;
  demo: boolean;
  error: string;
  mutationBusy: boolean;
  moreBusy: boolean;
  onRegistration: (join: boolean) => Promise<void>;
  onMore: () => Promise<void>;
  appearanceRpc?: HubRpc;
}) {
  const phase = competitionPhase(detail);
  const registrationOpen = phase === "upcoming";
  return (
    <div className="events-detail">
      <div className="events-detail-hero">
        <span className="events-detail-icon">
          <EventIcon icon={detail.badge_icon} />
        </span>
        <span className={`events-phase events-phase-${phase}`}>
          {phaseLabels[phase]}
        </span>
        <p>{detail.description}</p>
        <dl className="events-facts">
          <div>
            <dt>Période</dt>
            <dd>{eventDates(detail)}</dd>
          </div>
          <div>
            <dt>Score</dt>
            <dd>{metricLabels[detail.metric]}</dd>
          </div>
          <div>
            <dt>Badge</dt>
            <dd>{detail.badge_label}</dd>
          </div>
        </dl>
      </div>

      {registrationOpen && (
        <div className="events-registration">
          <p>
            En participant, ton pseudonyme, ton avatar et ton score deviennent
            visibles dans ce classement.
          </p>
          <button
            type="button"
            className={detail.joined ? "secondary full" : "primary full"}
            disabled={mutationBusy}
            onClick={() => void onRegistration(!detail.joined)}
          >
            {mutationBusy
              ? "Mise à jour…"
              : detail.joined
                ? "Quitter la compétition"
                : "Rejoindre la compétition"}
          </button>
          {demo && <small>Mode démo · cette inscription reste fictive.</small>}
        </div>
      )}

      {!registrationOpen && detail.joined && (
        <p className="events-lock-note">
          Ton inscription est verrouillée depuis le début de la compétition.
        </p>
      )}

      {error && (
        <p className="events-error" role="alert">
          {error}
        </p>
      )}

      <div className="events-ranking-heading">
        <div>
          <p className="eyebrow">CLASSEMENT</p>
          <h3>
            {detail.participant_count} participant
            {detail.participant_count > 1 ? "s" : ""}
          </h3>
        </div>
        {detail.my_rank !== null && (
          <span>
            Ton rang <strong>#{detail.my_rank}</strong>
          </span>
        )}
      </div>
      {detail.leaderboard.length ? (
        <LookList
          ids={detail.leaderboard.map((p) => p.user_id)}
          rpc={appearanceRpc}
        >
          {(looks) => (
            <div className="events-leaderboard">
              {detail.leaderboard.map((standing) => (
                <div className="events-standing" key={standing.user_id}>
                  <span className="events-rank">
                    {standing.rank === 1 ? <Trophy size={17} /> : standing.rank}
                  </span>
                  <span className="events-avatar">
                    <PlayerIdentity
                      variant={standing.avatar}
                      look={looks[standing.user_id]}
                    />
                  </span>
                  <span className="events-standing-name">
                    <strong>{standing.nickname}</strong>
                    {looks[standing.user_id]?.equipped.title && (
                      <small>
                        {
                          COSMETICS.find(
                            (c) =>
                              c.id === looks[standing.user_id].equipped.title,
                          )?.label
                        }
                      </small>
                    )}
                    <small>
                      {standing.action_count} action
                      {standing.action_count > 1 ? "s" : ""}
                    </small>
                  </span>
                  <b>{scoreFormat.format(standing.score)} min</b>
                </div>
              ))}
            </div>
          )}
        </LookList>
      ) : (
        <div className="events-empty">
          <Trophy size={27} aria-hidden="true" />
          <p>Le classement attend ses premiers scores.</p>
        </div>
      )}
      {detail.next_offset !== null && (
        <button
          type="button"
          className="secondary full events-more"
          disabled={moreBusy}
          onClick={() => void onMore()}
        >
          {moreBusy ? "Chargement…" : "Voir la suite"}
          {!moreBusy && <ChevronDown size={16} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
