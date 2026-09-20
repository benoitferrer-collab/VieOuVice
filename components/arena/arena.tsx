"use client";
import { useEffect, useState } from "react";
import {
  Swords,
  Shield,
  Zap,
  Flame,
  RefreshCw,
  ArrowLeft,
  Clock,
  Trophy,
} from "lucide-react";
import type { GameState } from "@/lib/game";
import type { PlayerLook } from "@/lib/progression/types";
import {
  MOVES,
  SPECIALS,
  type ArenaMove,
  type ArenaDuel,
} from "@/lib/arena/rules";
import { useArena } from "@/lib/arena/use-arena";
import { Reaper } from "../avatar";
import "./arena.css";
const icons = { quick: Zap, heavy: Swords, guard: Shield, special: Flame };
const statusLabel = {
  pending: "Invitation",
  active: "En combat",
  finished: "Terminé",
  declined: "Décliné",
  expired: "Expiré",
  cancelled: "Annulé",
};
export function Arena({
  game,
  demo,
  active,
  selectedId,
  onSelect,
  looks,
  onReward,
}: {
  game: GameState;
  demo: boolean;
  active: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  looks: Record<string, PlayerLook>;
  onReward: () => void;
}) {
  const arena = useArena(game, demo, active, selectedId, onReward);
  const duel = arena.duels.find((d) => d.id === selectedId);
  const [friend, setFriend] = useState("");
  const friends = game.friends.filter((f) => f.status === "accepted");
  return (
    <section
      className={`arena${selectedId ? " arena-focused" : ""}`}
      aria-label="Arène Némésis"
    >
      <header className="arena-heading">
        <div>
          <span className="arena-eyebrow">NÉMÉSIS · L’ARÈNE</span>
          <h2>Une rivalité. Un vrai duel.</h2>
          <p>Deux personnages, quatre choix. À toi de faire la différence.</p>
        </div>
        <button
          className="arena-icon"
          aria-label="Actualiser l’arène"
          disabled={arena.busy}
          onClick={() => void arena.refresh().catch(() => {})}
        >
          <RefreshCw size={17} />
        </button>
      </header>
      {demo && (
        <p className="arena-demo">
          SIMULATEUR · L’ami accepte et joue automatiquement. Les Éclats
          affichés sont fictifs.
        </p>
      )}
      {arena.error && (
        <p className="arena-error" role="alert">
          {arena.error}
        </p>
      )}
      {selectedId ? (
        <>
          <button className="arena-back" onClick={() => onSelect(null)}>
            <ArrowLeft size={16} /> Tous les duels
          </button>
          {duel ? (
            <Duel
              key={`${game.id}:${duel.id}`}
              duel={duel}
              me={game.id}
              looks={looks}
              busy={arena.busy || arena.recovering}
              calm={game.calm}
              mutate={arena.mutate}
              rematch={async () => {
                const d = await arena.invite(
                  duel.fighters.find((f) => f.user_id !== game.id)!.user_id,
                );
                if (d) onSelect(d.id);
              }}
            />
          ) : (
            <p className="arena-empty">
              {arena.loaded
                ? "Ce duel n’est plus accessible. Reviens à la liste pour retrouver tes combats."
                : "Chargement du duel…"}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="arena-invite">
            <div>
              <Swords size={24} />
              <h3>Entre dans l’arène</h3>
              <p>
                Défie un ami. Il a 24 h pour accepter, puis chacun dispose de 24
                h par tour.
              </p>
            </div>
            <div className="arena-invite-controls">
              <select
                aria-label="Ami à défier"
                value={friend}
                onChange={(e) => setFriend(e.target.value)}
              >
                <option value="">Choisir un ami</option>
                {friends.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nickname}
                  </option>
                ))}
              </select>
              <button
                className="arena-primary"
                disabled={!friend || arena.busy || arena.recovering}
                onClick={async () => {
                  const d = await arena.invite(friend);
                  if (d) onSelect(d.id);
                }}
              >
                Lancer un défi <Swords size={15} />
              </button>
            </div>
            {!friends.length && (
              <small>
                Ajoute un ami et attends son acceptation pour lancer un duel.
              </small>
            )}
          </div>
          <DuelList
            title="Combats en cours"
            duels={arena.duels.filter((d) =>
              ["pending", "active"].includes(d.status),
            )}
            me={game.id}
            onSelect={onSelect}
          />
          <DuelList
            title="Derniers duels"
            duels={arena.duels.filter(
              (d) => !["pending", "active"].includes(d.status),
            )}
            me={game.id}
            onSelect={onSelect}
          />
          {!arena.loaded && !arena.error && (
            <p className="arena-empty">Chargement de l’arène…</p>
          )}
        </>
      )}
      <details className="arena-rules">
        <summary>Les règles de l’arène</summary>
        <p>
          100 PV, 2 énergies au départ (maximum 4). L’invité commence. La garde
          divise le prochain coup par deux et ne se cumule pas. Après 40
          actions, le plus de PV gagne ; égalité possible.
        </p>
        <p>
          Victoire par KO ou limite de tours : 10 Éclats si chacun a joué au
          moins 3 fois, maximum 30 par jour (heure de Paris). Abandon et délai
          dépassé : aucune récompense. 3 duels ouverts maximum, 10 invitations
          par jour.
        </p>
        <p>
          Les cosmétiques sont visuels. Tes actions de vie et ton score
          n’affectent jamais le combat.
        </p>
      </details>
    </section>
  );
}
function DuelList({
  title,
  duels,
  me,
  onSelect,
}: {
  title: string;
  duels: ArenaDuel[];
  me: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="arena-list">
      <h3>
        {title} <span>{duels.length}</span>
      </h3>
      {!duels.length ? (
        <p className="arena-empty">Aucun duel pour le moment.</p>
      ) : (
        duels.map((d) => {
          const other = d.fighters.find((f) => f.user_id !== me);
          return (
            <button
              key={d.id}
              className="arena-duel-row"
              onClick={() => onSelect(d.id)}
            >
              <Reaper variant={other?.avatar} />
              <span>
                <strong>{other?.nickname ?? "Adversaire"}</strong>
                <small>
                  {d.status === "active"
                    ? d.turn_user_id === me
                      ? "À toi de jouer"
                      : "Au tour de ton ami"
                    : d.status === "finished"
                      ? d.winner_id === me
                        ? "Victoire"
                        : d.winner_id
                          ? "Défaite"
                          : "Égalité"
                      : statusLabel[d.status]}
                </small>
              </span>
              <span
                className={
                  d.turn_user_id === me
                    ? "arena-badge your-turn"
                    : "arena-badge"
                }
              >
                {d.status === "active"
                  ? `Tour ${d.turn_number}`
                  : statusLabel[d.status]}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
function Duel({
  duel: d,
  me,
  looks,
  busy,
  calm,
  mutate,
  rematch,
}: {
  duel: ArenaDuel;
  me: string;
  looks: Record<string, PlayerLook>;
  busy: boolean;
  calm: boolean;
  mutate: (
    name: string,
    p: Record<string, unknown>,
  ) => Promise<ArenaDuel | null>;
  rematch: () => Promise<void>;
}) {
  const [seen, setSeen] = useState(0),
    [confirm, setConfirm] = useState(false),
    [replayKey, setReplayKey] = useState(0);
  const last = d.moves.at(-1);
  const lastTurn = last?.turn;
  const replay = !!last && last.turn > seen;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!lastTurn) return;
    const timer = setTimeout(
      () => setSeen(lastTurn),
      calm || window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 1600,
    );
    return () => clearTimeout(timer);
  }, [lastTurn, replayKey, calm]);
  const mine = d.fighters.find((f) => f.user_id === me)!;
  const fighters = [mine, ...d.fighters.filter((f) => f.user_id !== me)];
  const myTurn = d.status === "active" && d.turn_user_id === me;
  const special = SPECIALS[((mine.avatar % 4) + 4) % 4];
  const remaining = Math.max(
    0,
    Math.min(24, Math.ceil((Date.parse(d.deadline) - now) / 3600000)),
  );
  return (
    <div>
      <div className="arena-combat-meta">
        <span>
          {d.status === "active"
            ? `TOUR ${d.turn_number} / 40`
            : statusLabel[d.status].toUpperCase()}
        </span>
        <span>
          <Clock size={13} />
          {!["pending", "active"].includes(d.status)
            ? "Combat clos"
            : remaining
              ? `${remaining} h restantes`
              : "Délai écoulé"}
        </span>
      </div>
      <div
        className={`arena-stage ${replay ? "arena-playing" : ""}`}
        key={replayKey}
      >
        {fighters.map((f, i) => (
          <div
            key={f.user_id}
            className={`arena-fighter arena-fighter-${i} ${replay && last?.actor_id === f.user_id ? "arena-striking" : ""}`}
          >
            <div className="arena-fighter-name">
              <strong>{f.nickname}</strong>
              <small>{f.user_id === me ? "TOI" : "ADVERSAIRE"}</small>
            </div>
            <div
              className="arena-hp"
              role="progressbar"
              aria-label={`PV de ${f.nickname}`}
              aria-valuenow={f.hp}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${f.hp}%` }} />
            </div>
            <div className="arena-vitals">
              <span>{f.hp} / 100 PV</span>
              <span aria-label={`${f.energy} énergies sur 4`}>
                {"◆".repeat(f.energy)}
                {"◇".repeat(4 - f.energy)}
              </span>
            </div>
            <div className="arena-character">
              <Reaper
                variant={f.avatar}
                large
                cosmetics={looks[f.user_id]?.equipped}
                celebration={
                  d.status === "finished" && d.winner_id === f.user_id ? 1 : 0
                }
              />
              {f.guard && (
                <span className="arena-shield">
                  <Shield size={17} /> Garde
                </span>
              )}
            </div>
          </div>
        ))}
        <span className="arena-vs">VS</span>
      </div>
      {last && (
        <div className="arena-replay" aria-live="polite">
          <p>
            <strong>
              {d.fighters.find((f) => f.user_id === last.actor_id)?.nickname}
            </strong>{" "}
            · {MOVES[last.move]?.label ?? last.move}
            {last.damage > 0 && ` · −${last.damage} PV`}
            {last.healing > 0 && ` · +${last.healing} PV`}
          </p>
          <button
            onClick={() => {
              if (replay) setSeen(last.turn);
              else {
                setSeen(0);
                setReplayKey((k) => k + 1);
              }
            }}
          >
            {replay ? "Passer" : "Revoir"}
          </button>
        </div>
      )}
      {d.status === "pending" ? (
        <div className="arena-state">
          <h3>Le défi est lancé</h3>
          {d.opponent_id === me ? (
            <>
              <p>Accepte et joue le premier coup.</p>
              <button
                disabled={busy}
                className="arena-primary"
                onClick={() =>
                  void mutate("arena_respond", {
                    p_duel_id: d.id,
                    p_accept: true,
                  })
                }
              >
                Accepter le duel
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void mutate("arena_respond", {
                    p_duel_id: d.id,
                    p_accept: false,
                  })
                }
              >
                Décliner
              </button>
            </>
          ) : (
            <p>Ton ami dispose de 24 h pour accepter l’invitation.</p>
          )}
        </div>
      ) : d.status === "active" ? (
        <>
          <div className="arena-turn">
            <span className={myTurn ? "your-turn" : ""}>
              {myTurn ? "À TOI DE JOUER" : "AU TOUR DE TON AMI"}
            </span>
            <small>
              {replay
                ? "Le dernier coup se joue…"
                : myTurn
                  ? "Choisis ton prochain mouvement."
                  : "Tu peux revenir plus tard : le combat t’attend."}
            </small>
          </div>
          <div className="arena-actions">
            {(Object.keys(MOVES) as ArenaMove[]).map((move) => {
              const Icon = icons[move];
              return (
                <button
                  key={move}
                  disabled={
                    !myTurn ||
                    busy ||
                    replay ||
                    mine.energy < MOVES[move].cost ||
                    remaining === 0
                  }
                  onClick={() =>
                    void mutate("arena_move", {
                      p_duel_id: d.id,
                      p_move: move,
                      p_expected_turn: d.turn_number,
                    })
                  }
                >
                  <Icon size={21} />
                  <strong>{MOVES[move].label}</strong>
                  <small>
                    {move === "special"
                      ? `${special.damage} dégâts${special.heal ? ` · +${special.heal} PV` : ""} · −3 énergie`
                      : MOVES[move].description}
                  </small>
                </button>
              );
            })}
          </div>
          {confirm ? (
            <div className="arena-confirm">
              <p>Abandonner donne la victoire à ton ami, sans récompense.</p>
              <button
                disabled={busy}
                onClick={() =>
                  void mutate("arena_surrender", { p_duel_id: d.id })
                }
              >
                Confirmer l’abandon
              </button>
              <button onClick={() => setConfirm(false)}>
                Continuer le duel
              </button>
            </div>
          ) : (
            <button
              className="arena-surrender"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Abandonner le duel
            </button>
          )}
        </>
      ) : (
        <div className="arena-state arena-result">
          <Trophy size={30} />
          <h3>
            {d.status === "finished"
              ? d.winner_id === me
                ? "Victoire !"
                : d.winner_id
                  ? "Un duel bien livré"
                  : "Égalité parfaite"
              : statusLabel[d.status]}
          </h3>
          <p>
            {d.finish_reason === "surrender"
              ? "Le combat s’est terminé par abandon."
              : d.finish_reason === "timeout"
                ? "Le délai de 24 h a été dépassé."
                : d.finish_reason === "ko"
                  ? "Le dernier coup a fait la différence."
                  : d.finish_reason === "turn_limit"
                    ? "La limite des 40 actions est atteinte."
                    : "Ce duel est clos."}
          </p>
          {d.reward > 0 && d.winner_id === me && (
            <strong>+{d.reward} Éclats</strong>
          )}
          <button
            className="arena-primary"
            disabled={busy}
            onClick={() => void rematch()}
          >
            Proposer une revanche
          </button>
        </div>
      )}
      {d.moves.length > 0 && (
        <details className="arena-rules">
          <summary>Journal du combat · {d.moves.length} actions</summary>
          <ol className="arena-log">
            {d.moves.map((m) => (
              <li key={m.turn}>
                #{m.turn} ·{" "}
                {d.fighters.find((f) => f.user_id === m.actor_id)?.nickname} ·{" "}
                {MOVES[m.move]?.label ?? m.move} · {m.damage} dégâts
                {m.healing > 0 ? ` · +${m.healing} PV` : ""}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
