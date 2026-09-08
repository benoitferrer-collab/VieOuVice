"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Flame,
  Heart,
  Leaf,
  LogOut,
  Medal,
  Moon,
  Plus,
  Settings2,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UserRound,
  Users,
  WifiOff,
  LockKeyhole,
  RotateCcw,
} from "lucide-react";
import { NotificationToast } from "./notification-toast";
import { notificationTab } from "@/lib/notifications";
import { cleanupWebPushBeforeSignOut } from "./web-push-settings";
import { useGame } from "@/lib/use-game";
import { useSocialHub } from "@/lib/events/use-social-hub";
import { Competitions } from "./competitions";
import { AdminPanel } from "./admin-panel";
import { FriendActivity } from "./friend-activity";
import { CompetitionBadges } from "./competition-badges";
import {
  gaugePercent,
  parisDay,
  promotionCount,
  signed,
  statusFor,
  type Kind,
  type Friend,
  makeDemo,
} from "@/lib/game";
import { Reaper } from "./avatar";
import { Sheet } from "./sheet";
import { AuthForm } from "./auth-form";
import { ActionList } from "./action-list";
import { Leaderboard } from "./leaderboard";
import { ActionSheet } from "./action-sheet";
import { Onboarding } from "./onboarding";
import { SettingsSheet } from "./settings-sheet";
import { FriendSheet } from "./friend-sheet";
import { DonationSheet } from "./donation-sheet";

const tabs = [
  { id: "survie", label: "Survie", icon: Heart },
  { id: "ligue", label: "Ligue", icon: Trophy },
  { id: "nemesis", label: "Némésis", icon: Swords },
  { id: "amis", label: "Amis", icon: Users },
  { id: "profil", label: "Profil", icon: UserRound },
] as const;
type Tab = (typeof tabs)[number]["id"];
type Panel =
  | "rules"
  | "health"
  | "excess"
  | "journal"
  | "notifications"
  | "settings"
  | "friend"
  | "donate"
  | "admin"
  | null;
export function Game({
  configured,
  configError,
}: {
  configured: boolean;
  configError: string;
}) {
  const game = useGame(configured);
  const social = useSocialHub(game.state, game.demo);
  const [selectedFriend, setSelectedFriend] = useState<{
    owner: string;
    friend: Friend;
  } | null>(null);
  const [tab, setTab] = useState<Tab>("survie");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested) {
      window.setTimeout(() => setTab(notificationTab(requested)), 0);
    }
  }, []);
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState("");
  const [journalKind, setJournalKind] = useState<"all" | Kind>("all");
  function tell(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 5000);
  }
  if (game.loading)
    return (
      <main className="auth-page" role="status">
        <div className="loader" />
        <p>Préparation de ta partie…</p>
      </main>
    );
  if (game.needsProfile && !game.demo)
    return (
      <Onboarding
        save={async (nickname, avatar) => {
          await game.mutate("create_profile", {
            p_nickname: nickname,
            p_avatar: avatar,
          });
          await game.refresh();
        }}
      />
    );
  if (!game.state) {
    if (game.error)
      return (
        <main className="auth-page">
          <Skull size={40} />
          <h1>Connexion interrompue.</h1>
          <p role="alert">{game.error}</p>
          <button className="primary" onClick={() => void game.refresh()}>
            Réessayer
          </button>
          <button className="text-button" onClick={game.startDemo}>
            Ouvrir la démo
          </button>
        </main>
      );
    return <AuthForm onDemo={game.startDemo} />;
  }
  const state = game.state;
  const status = statusFor(state.balance);
  const today = state.actions.filter(
    (a) => parisDay(a.created_at) === parisDay(new Date()),
  );
  const earned = today.reduce((n, a) => n + Math.max(0, a.minutes_impact), 0);
  const lost = today.reduce((n, a) => n + Math.min(0, a.minutes_impact), 0);
  const rank =
    [...state.players]
      .sort(
        (a, b) => b.weekly_score - a.weekly_score || a.id.localeCompare(b.id),
      )
      .findIndex((p) => p.id === state.id) + 1;
  const subtitle = {
    survie: "Un jour de plus. Bien joué.",
    ligue: "La survie est un sport collectif.",
    nemesis: "Un peu de rivalité, beaucoup de jeu.",
    amis: "On survit mieux à plusieurs.",
    profil: "Ta légende, petits écarts compris.",
  };
  return (
    <MotionConfig reducedMotion={state.calm ? "always" : "user"}>
      <div className={"game-shell" + (state.calm ? " calm" : "")}>
        <header className="topbar">
          <Link href="/" className="brand" aria-label="Excès-O-Meter, accueil">
            <span className="brand-icon">
              <Skull size={20} />
            </span>
            EXCÈS<span className="brand-dot">·</span>O
            <span className="brand-dot">·</span>METER
          </Link>
          <button
            className="icon-button notification-button"
            aria-label="Notifications"
            onClick={() => setPanel("notifications")}
          >
            <Bell size={20} />
            {state.notifications.some((n) => !n.read_at) && (
              <span className="notification-count">
                {Math.min(
                  99,
                  state.notifications.filter((n) => !n.read_at).length,
                )}
              </span>
            )}
          </button>
        </header>
        {game.demo && (
          <div className="demo-strip">
            <span>
              <i />
              MODE DÉMO <span className="demo-detail">· données fictives</span>
            </span>
            {configured ? (
              <button onClick={() => void game.signOut()}>
                Se connecter <ArrowRight size={12} />
              </button>
            ) : (
              <button onClick={() => setPanel("rules")}>
                Explorer librement <ArrowRight size={12} />
              </button>
            )}
          </div>
        )}
        {!game.online && (
          <div className="offline" role="status">
            <WifiOff size={16} />
            Hors connexion · tes brouillons restent ici.
          </div>
        )}
        {(game.error || configError) && (
          <div className="error-banner" role="alert">
            {game.error || configError}
          </div>
        )}
        {social.error && (
          <div className="error-banner" role="alert">
            {social.error}
            <button
              className="text-button"
              onClick={() => void social.refresh()}
            >
              Réessayer
            </button>
          </div>
        )}
        <div className="sticky-meter">
          <span className={status.className}>
            <span className="status-dot" />
            {status.name}
          </span>
          <span>
            <b>{new Intl.NumberFormat("fr-FR").format(state.balance)}</b>{" "}
            <small>min de vie</small>
          </span>
          <button
            className="icon-button compact"
            onClick={() => setPanel("rules")}
            aria-label="Comprendre les règles"
          >
            <CircleHelp size={17} />
          </button>
          <div className="mini-track">
            <span style={{ width: gaugePercent(state.balance) + "%" }} />
          </div>
        </div>
        <main className="game-main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {tab === "survie"
                  ? "TON BULLETIN DE SURVIE"
                  : tab === "ligue"
                    ? "LE CLASSEMENT"
                    : tab === "nemesis"
                      ? "TON DUEL DE LA SEMAINE"
                      : tab === "amis"
                        ? "LE CERCLE DES VIVANTS"
                        : "CARTE DE MORTEL"}
              </p>
              <h1>
                {tab === "survie" ? (
                  <>
                    Salut, <span>survivant.</span>
                  </>
                ) : (
                  tabs.find((t) => t.id === tab)?.label
                )}
              </h1>
              <p className="muted">{subtitle[tab]}</p>
            </div>
            {tab === "survie" && (
              <span className="day-badge">
                <span>
                  {new Intl.DateTimeFormat("fr-FR", { weekday: "short" })
                    .format(new Date())
                    .replace(".", "")
                    .toUpperCase()}
                </span>
                <b>{new Date().getDate()}</b>
              </span>
            )}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {tab === "survie" && (
                <>
                  <section className="survival-card">
                    <div className="survival-card-top">
                      <span className="pill">
                        <span className="status-dot" />
                        ENCORE DANS LA PARTIE
                      </span>
                      <button
                        className="icon-button compact"
                        aria-label="Règles du compteur"
                        onClick={() => setPanel("rules")}
                      >
                        <CircleHelp size={18} />
                      </button>
                    </div>
                    <div className="avatar-stage">
                      <span className="orbit orbit-one" />
                      <span className="orbit orbit-two" />
                      <span className="stage-spark spark-one">✦</span>
                      <span className="stage-spark spark-two">+</span>
                      <Reaper
                        variant={
                          state.balance <= 0
                            ? 3
                            : state.balance <= 250
                              ? 1
                              : state.balance >= 2000
                                ? 2
                                : state.avatar
                        }
                        large
                      />
                      <span className="avatar-status">
                        <Shield size={12} />
                        {status.name}
                      </span>
                    </div>
                    <p className="survival-caption">TON CAPITAL VIE</p>
                    <div className={"balance " + status.className}>
                      {new Intl.NumberFormat("fr-FR").format(state.balance)}
                      <span>min de vie</span>
                    </div>
                    <p className="reaper-quote">
                      {state.soft ? "Ton aventure continue." : status.message}
                    </p>
                    <div className="survival-track">
                      <span
                        style={{ width: gaugePercent(state.balance) + "%" }}
                      />
                    </div>
                    <div className="scale">
                      <span>
                        <Skull size={12} />0
                      </span>
                      <span>
                        2 000 <Sparkles size={12} />
                      </span>
                    </div>
                    <div className="card-disclaimer">
                      <Shield size={12} />
                      Fictif à 100 %. Vivant pour de vrai.
                    </div>
                  </section>
                  {social.hub && (
                    <Competitions
                      events={social.hub.events}
                      demo={game.demo}
                      rpc={social.rpc}
                      changed={social.refresh}
                    />
                  )}
                  <section className="today-section">
                    <div className="section-heading">
                      <h2>Aujourd’hui</h2>
                      <span className="muted small">
                        Chaque petit choix compte
                      </span>
                    </div>
                    <div className="daily-grid">
                      <div className="daily-stat">
                        <span className="stat-icon health">
                          <ArrowUpRight size={21} />
                        </span>
                        <div>
                          <strong className="lime">
                            +{earned}
                            <small> min</small>
                          </strong>
                          <span>Vie gagnée</span>
                        </div>
                      </div>
                      <div className="daily-stat">
                        <span className="stat-icon excess">
                          <ArrowDownLeft size={21} />
                        </span>
                        <div>
                          <strong className="coral">
                            {lost}
                            <small> min</small>
                          </strong>
                          <span>Vie perdue</span>
                        </div>
                      </div>
                    </div>
                  </section>
                  <button
                    className="objective-row"
                    onClick={() => setPanel("health")}
                  >
                    <span className="objective-icon">
                      <Target size={23} />
                    </span>
                    <span>
                      <span className="eyebrow lime">
                        LE PROCHAIN PETIT PAS
                      </span>
                      <strong>
                        {today.some((a) => a.kind === "health")
                          ? "Garde ton propre rythme."
                          : "Une bonne habitude, pour commencer."}
                      </strong>
                      <span className="muted small">
                        {today.some((a) => a.kind === "health")
                          ? "Pas besoin d’en faire plus pour aujourd’hui."
                          : "Déclare une pause ou une balade."}
                      </span>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                  <section className="duel-preview">
                    <div className="section-heading">
                      <h2>
                        <Swords size={18} />
                        Le duel de la semaine
                      </h2>
                      <span className="live-dot">
                        {state.nemesis ? "EN COURS" : "EN ATTENTE"}
                      </span>
                    </div>
                    {state.nemesis ? (
                      <>
                        <div className="mini-duel">
                          <div>
                            <div className="mini-avatar you">
                              <Reaper variant={state.avatar} />
                            </div>
                            <strong>Toi</strong>
                            <span className="lime">
                              {signed(state.weekly_score)} pts
                            </span>
                          </div>
                          <span className="versus">VS</span>
                          <div>
                            <div className="mini-avatar rival">
                              <Reaper variant={state.nemesis.avatar} />
                            </div>
                            <strong>{state.nemesis.nickname}</strong>
                            <span>
                              {signed(state.nemesis.weekly_score)} pts
                            </span>
                          </div>
                        </div>
                        <button
                          className="duel-link"
                          onClick={() => setTab("nemesis")}
                        >
                          {state.nemesis.weekly_score > state.weekly_score
                            ? `${state.nemesis.weekly_score - state.weekly_score} points vous séparent.`
                            : "Tu tiens le cap."}
                          <ArrowRight size={16} />
                        </button>
                      </>
                    ) : (
                      <p className="empty-copy">
                        Aucun rival disponible cette semaine.
                      </p>
                    )}
                  </section>
                  <section>
                    <div className="section-heading">
                      <h2>Les derniers mouvements</h2>
                      <button
                        className="text-button small"
                        onClick={() => setPanel("journal")}
                      >
                        Tout voir <ArrowRight size={14} />
                      </button>
                    </div>
                    <ActionList actions={state.actions.slice(0, 3)} />
                  </section>
                </>
              )}
              {tab === "ligue" && (
                <>
                  <div className="league-hero">
                    <div className="league-emblem">
                      <Shield size={66} strokeWidth={1} />
                      <Trophy size={27} />
                    </div>
                    <span className="eyebrow amber">SAISON EN COURS</span>
                    <h2>{state.league_name || "Ta première ligue"}</h2>
                    <p className="muted">
                      {state.players.length} mortels. Une semaine pour se
                      dépasser.
                    </p>
                    <div className="season-pill">
                      <Clock3 size={15} />
                      Fin le{" "}
                      {new Intl.DateTimeFormat("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Paris",
                      }).format(new Date(state.season_end))}
                    </div>
                  </div>
                  <div className="score-summary">
                    <span>
                      Ta position<strong>{rank ? `#${rank}` : "—"}</strong>
                    </span>
                    <span>
                      Score hebdomadaire
                      <strong className="lime">
                        {signed(state.weekly_score)}
                        <small> pts</small>
                      </strong>
                    </span>
                  </div>
                  <div className="section-heading">
                    <h2>La course est lancée</h2>
                    <span className="small muted">
                      {game.demo ? "Classement fictif" : "Cette semaine"}
                    </span>
                  </div>
                  <Leaderboard state={state} />
                  <p className="fine-print">
                    {promotionCount(state.players.length)} montée(s) et
                    descente(s) à la clôture. Les dons ne rapportent aucun point
                    de ligue.
                  </p>
                </>
              )}
              {tab === "nemesis" && (
                <>
                  <section className="rival-hero">
                    <span className="eyebrow lavender">
                      RENDEZ-VOUS AVEC TON RIVAL
                    </span>
                    <h2>
                      Deux mortels.
                      <br />
                      Une longueur d’avance.
                    </h2>
                    {state.nemesis ? (
                      <>
                        <div className="large-duel">
                          <div>
                            <Reaper variant={state.avatar} />
                            <strong>Toi</strong>
                            <b className="lime">{signed(state.weekly_score)}</b>
                          </div>
                          <Swords className="lavender" size={30} />
                          <div>
                            <Reaper variant={state.nemesis.avatar} />
                            <strong>{state.nemesis.nickname}</strong>
                            <b className="lavender">
                              {signed(state.nemesis.weekly_score)}
                            </b>
                          </div>
                        </div>
                        <div className="duel-progress">
                          <span
                            style={{
                              width:
                                Math.max(
                                  5,
                                  Math.min(
                                    95,
                                    50 +
                                      (state.weekly_score -
                                        state.nemesis.weekly_score) /
                                        10,
                                  ),
                                ) + "%",
                            }}
                          />
                        </div>
                        <p className="muted">
                          Le score de la semaine décide du duel.
                        </p>
                      </>
                    ) : (
                      <div className="empty-state">
                        <Swords size={44} />
                        <h3>Aucun rival pour le moment.</h3>
                        <p>
                          Active les duels dans tes préférences. Un partenaire
                          consentant te sera proposé à la prochaine saison.
                        </p>
                      </div>
                    )}
                  </section>
                  <section className="info-panel">
                    <Shield size={24} className="lime" />
                    <div>
                      <h3>La compétition, à ton rythme.</h3>
                      <p>
                        Les duels sont facultatifs. Tes déclarations restent
                        privées, même pour ton Némésis.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => setPanel("settings")}
                      >
                        Mes préférences <ArrowRight size={16} />
                      </button>
                    </div>
                  </section>
                  <section className="locked-feature">
                    <LockKeyhole size={22} />
                    <div>
                      <h3>Les coups du sort</h3>
                      <p>
                        Paris, traquenards et roulette arriveront dans le lot
                        avancé. Aucun pari n’est ouvert.
                      </p>
                    </div>
                  </section>
                </>
              )}
              {tab === "amis" && (
                <>
                  <section className="friends-intro">
                    <div className="friends-art">
                      <Reaper variant={2} />
                      <Reaper variant={0} />
                      <Reaper variant={1} />
                    </div>
                    <h2>Ta bande de survivants.</h2>
                    <p className="muted">
                      Pour les petits coups de pouce
                      <br />
                      et les grandes remontées.
                    </p>
                    <button
                      className="primary"
                      onClick={() => setPanel("friend")}
                    >
                      <Plus size={18} />
                      Ajouter un ami
                    </button>
                  </section>
                  <div className="section-heading">
                    <h2>Dans ton cercle</h2>
                    <span className="count-badge">{state.friends.length}</span>
                  </div>
                  {state.friends.length ? (
                    state.friends.map((friend) => (
                      <div className="friend-row" key={friend.id}>
                        <div className="mini-avatar">
                          <Reaper variant={friend.avatar} />
                        </div>
                        <div className="friend-name">
                          {friend.status === "accepted" && social.hub ? (
                            <button
                              className="friend-profile-button"
                              onClick={() =>
                                setSelectedFriend({ owner: state.id, friend })
                              }
                              aria-label={`Voir la semaine de ${friend.nickname}`}
                            >
                              <strong>{friend.nickname}</strong>
                              <small>
                                Voir ses 7 derniers jours{" "}
                                <ChevronRight size={13} />
                              </small>
                            </button>
                          ) : (
                            <strong>{friend.nickname}</strong>
                          )}
                          <span className="small muted">
                            {friend.status === "accepted"
                              ? "Amitié acceptée"
                              : friend.incoming
                                ? "T’invite à rejoindre son cercle"
                                : "Invitation envoyée"}
                          </span>
                        </div>
                        {friend.status === "pending" && friend.incoming ? (
                          <button
                            className="icon-button"
                            aria-label={"Accepter " + friend.nickname}
                            onClick={async () => {
                              try {
                                await game.mutate("respond_friend", {
                                  p_friend_id: friend.id,
                                  p_accept: true,
                                });
                                tell("Bienvenue dans le cercle.");
                              } catch (e) {
                                tell(String(e));
                              }
                            }}
                          >
                            <Check size={20} />
                          </button>
                        ) : (
                          <span className="lime">
                            <Shield size={17} />
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <Users size={32} />
                      <p>Ton cercle commence avec une première invitation.</p>
                    </div>
                  )}
                  <button
                    className="gift-card"
                    onClick={() => setPanel("donate")}
                  >
                    <span className="gift-icon">
                      <Heart size={25} />
                    </span>
                    <span>
                      <strong>Un peu de vie, ça se partage.</strong>
                      <span>Offrir des minutes de vie à un ami</span>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                  <p className="fine-print">
                    Les dons sont gratuits, fictifs et sans effet sur le
                    classement.
                  </p>
                </>
              )}
              {tab === "profil" && (
                <>
                  <section className="profile-card">
                    <Reaper variant={state.avatar} large />
                    <h2>{state.nickname}</h2>
                    <span className={"pill " + status.className}>
                      {status.name}
                    </span>
                    <div className="profile-stats">
                      <span>
                        <strong>{state.actions.length}</strong>déclarations
                      </span>
                      <span>
                        <strong>
                          {state.trophies.length +
                            (social.hub?.badges.length || 0)}
                        </strong>
                        trophée(s)
                      </span>
                      <span>
                        <strong>{rank ? `#${rank}` : "—"}</strong>dans ta ligue
                      </span>
                    </div>
                  </section>
                  <div className="section-heading">
                    <h2>Le cabinet des curiosités</h2>
                    <Medal size={18} className="amber" />
                  </div>
                  <div className="trophy-grid">
                    {[
                      {
                        code: "first-step",
                        name: "Premier souffle",
                        icon: Leaf,
                      },
                      {
                        code: "maine-coon",
                        name: "Esprit du Maine Coon",
                        icon: Moon,
                      },
                      {
                        code: "grande-scopa",
                        name: "La Grande Scopa",
                        icon: Sparkles,
                      },
                    ].map((t) => (
                      <div
                        className={
                          "trophy " +
                          (state.trophies.includes(t.code) ? "unlocked" : "")
                        }
                        key={t.code}
                      >
                        <t.icon size={28} />
                        <strong>{t.name}</strong>
                        <span>
                          {state.trophies.includes(t.code)
                            ? "Débloqué"
                            : "À venir"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {social.hub && (
                    <CompetitionBadges badges={social.hub.badges} />
                  )}
                  <div className="menu-list">
                    {social.hub?.is_admin && !game.demo && (
                      <MenuItem
                        icon={<Shield size={20} />}
                        label="Administration du jeu"
                        onClick={() => setPanel("admin")}
                      />
                    )}
                    <MenuItem
                      icon={<BookOpen size={20} />}
                      label="Mon journal"
                      onClick={() => setPanel("journal")}
                    />
                    <MenuItem
                      icon={<Settings2 size={20} />}
                      label="Préférences et confidentialité"
                      onClick={() => setPanel("settings")}
                    />
                    <MenuItem
                      icon={<CircleHelp size={20} />}
                      label="Les règles du jeu"
                      onClick={() => setPanel("rules")}
                    />
                    <MenuItem
                      icon={<Download size={20} />}
                      label="Exporter mes données"
                      onClick={() => {
                        if (!game.demo) {
                          const link = document.createElement("a");
                          link.href = "/api/export";
                          link.download = "exces-o-meter-export.json";
                          link.click();
                          return;
                        }
                        const url = URL.createObjectURL(
                          new Blob([JSON.stringify(state, null, 2)], {
                            type: "application/json",
                          }),
                        );
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "exces-demo.json";
                        a.click();
                        URL.revokeObjectURL(url);
                        tell("Export de démo téléchargé.");
                      }}
                    />
                    <MenuItem
                      icon={
                        game.demo ? (
                          <RotateCcw size={20} />
                        ) : (
                          <LogOut size={20} />
                        )
                      }
                      label={
                        game.demo ? "Réinitialiser la démo" : "Se déconnecter"
                      }
                      onClick={() => {
                        if (game.demo) {
                          game.localPatch(makeDemo());
                          social.resetDemo();
                          tell("Une nouvelle démo commence.");
                        } else {
                          void (async () => {
                            try {
                              await cleanupWebPushBeforeSignOut();
                              await game.signOut();
                            } catch (e) {
                              tell(
                                e instanceof Error
                                  ? e.message
                                  : "Déconnexion impossible. Réessaie.",
                              );
                            }
                          })();
                        }
                      }}
                    />
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
          <footer className="game-footer">
            <Skull size={15} />
            <span>ON JOUE AVEC LES MINUTES. PAS AVEC LA SANTÉ.</span>
          </footer>
        </main>
        <div className="floating-actions">
          <button
            className="fab excess-fab"
            onClick={() => setPanel("excess")}
            aria-label="Déclarer un excès"
          >
            <Flame size={21} />
            <span>Petit écart</span>
            <Plus size={17} />
          </button>
          <button
            className="fab health-fab"
            onClick={() => setPanel("health")}
            aria-label="Ajouter une action saine"
          >
            <Leaf size={21} />
            <span>Bonne habitude</span>
            <Plus size={17} />
          </button>
        </div>
        <nav className="bottom-nav" aria-label="Navigation principale">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => {
                setTab(t.id);
                window.scrollTo({
                  top: 0,
                  behavior: state.calm ? "instant" : "smooth",
                });
              }}
            >
              <t.icon size={21} strokeWidth={tab === t.id ? 2.3 : 1.7} />
              <span>{t.label}</span>
              {tab === t.id && <i />}
            </button>
          ))}
        </nav>
        {game.liveNotice && !toast && (
          <NotificationToast
            key={game.liveNotice.id}
            notice={game.liveNotice}
            onOpen={() => {
              setPanel(null);
              setTab(notificationTab(game.liveNotice?.target_tab));
              void game
                .readNotice(game.liveNotice!.id)
                .catch((e) => tell(String(e)));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            <Check size={18} />
            {toast}
          </div>
        )}
        {(panel === "health" || panel === "excess") && (
          <ActionSheet
            scope={state.id}
            kind={panel}
            items={state.catalog}
            onClose={() => setPanel(null)}
            record={game.record}
            demo={game.demo}
            communityEnabled={!!state.community_enabled}
            create={game.createCatalog}
          />
        )}
        {panel === "rules" && (
          <Sheet title="Les règles des vivants" onClose={() => setPanel(null)}>
            <div className="rules-intro">
              <Skull size={30} />
              <h3>Un jeu. Pas une prédiction.</h3>
              <p>
                Les « minutes de vie » gagnées ou perdues sont fictives. Elles
                ne mesurent ni ton espérance de vie ni ta santé. Une bonne
                habitude n’annule pas les effets réels d’un excès.
              </p>
            </div>
            <div className="rule-row">
              <Heart />
              <div>
                <h3>Ton capital vie</h3>
                <p>
                  500 minutes au départ. Le solde peut devenir négatif : tu
                  deviens Zombie, mais tu peux continuer à jouer.
                </p>
              </div>
            </div>
            <div className="rule-row">
              <Trophy />
              <div>
                <h3>Une nouvelle course chaque lundi</h3>
                <p>
                  Les actions comptent dans ton score hebdomadaire. Les dons et
                  le bonus de bienvenue n’y comptent pas. Semaine à l’heure de
                  Paris.
                </p>
              </div>
            </div>
            <div className="rule-row">
              <Shield />
              <div>
                <h3>À ton rythme</h3>
                <p>
                  Les gains sains sont plafonnés. Les duels nécessitent ton
                  accord. Réservé aux adultes, sans argent ni récompense de
                  valeur réelle.
                </p>
              </div>
            </div>
            {game.demo && (
              <p className="notice">
                Tu explores une démo : les joueurs et le classement sont
                fictifs. Tes essais restent dans ce navigateur.
                {!configured &&
                  " La connexion sera disponible une fois Supabase configuré."}
              </p>
            )}
            <button className="primary full" onClick={() => setPanel(null)}>
              Compris, je garde le cap <Check size={18} />
            </button>
          </Sheet>
        )}
        {panel === "journal" && (
          <Sheet title="Ton journal de bord" onClose={() => setPanel(null)}>
            <div className="segmented">
              {(["all", "health", "excess"] as const).map((k) => (
                <button
                  key={k}
                  className={journalKind === k ? "selected" : ""}
                  onClick={() => setJournalKind(k)}
                >
                  {k === "all"
                    ? "Tout"
                    : k === "health"
                      ? "Habitudes"
                      : "Écarts"}
                </button>
              ))}
            </div>
            <ActionList
              actions={state.actions.filter(
                (a) => journalKind === "all" || a.kind === journalKind,
              )}
            />
            <p className="fine-print">
              Tes 100 dernières déclarations. Journal privé ; l’export contient
              l’historique complet.
            </p>
          </Sheet>
        )}
        {panel === "notifications" && (
          <Sheet
            title="Du nouveau chez les vivants"
            onClose={() => setPanel(null)}
          >
            {state.notifications.length ? (
              state.notifications.map((n) => (
                <button
                  className={
                    "notification-row " + (!n.read_at ? "is-unread" : "")
                  }
                  key={n.id}
                  onClick={() => {
                    setPanel(null);
                    setTab(notificationTab(n.target_tab));
                    void game.readNotice(n.id).catch((e) => tell(String(e)));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <Bell size={19} />
                  <span className="notification-content">
                    {n.message}
                    <small>
                      {new Intl.DateTimeFormat("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(n.created_at))}
                    </small>
                  </span>
                  {!n.read_at && <span className="unread-dot" />}
                </button>
              ))
            ) : (
              <div className="empty-state">
                <Bell size={36} />
                <p>Rien à signaler. Profite de ce calme.</p>
              </div>
            )}
            <button
              className="secondary full"
              onClick={async () => {
                try {
                  if (game.demo)
                    game.localPatch({
                      notifications: state.notifications.map((n) => ({
                        ...n,
                        read_at: new Date().toISOString(),
                      })),
                    });
                  else await game.mutate("read_notifications", {});
                  setPanel(null);
                } catch (e) {
                  tell(String(e));
                }
              }}
            >
              Tout marquer comme lu
            </button>
          </Sheet>
        )}
        {panel === "settings" && (
          <SettingsSheet
            state={state}
            demo={game.demo}
            onClose={() => setPanel(null)}
            save={async (patch) => {
              if (game.demo) game.localPatch(patch);
              else
                await game.mutate("update_settings", {
                  p_calm: patch.calm ?? state.calm,
                  p_soft: patch.soft ?? state.soft,
                  p_pvp: patch.pvp ?? state.pvp,
                });
              tell("Préférences enregistrées.");
            }}
            mutate={game.mutate}
            saveSocial={game.saveSocialSettings}
            historySharing={
              social.hub
                ? {
                    enabled: social.hub.share_history,
                    save: async (enabled: boolean) => {
                      await social.rpc("update_history_sharing", {
                        p_enabled: enabled,
                      });
                      await social.refresh();
                    },
                  }
                : undefined
            }
          />
        )}
        {panel === "admin" && social.hub?.is_admin && !game.demo && (
          <AdminPanel
            userId={state.id}
            rpc={social.rpc}
            changed={async () => {
              await social.refresh();
              await game.refresh();
            }}
            onClose={() => setPanel(null)}
          />
        )}
        {selectedFriend?.owner === state.id && social.hub && (
          <FriendActivity
            key={`${state.id}:${selectedFriend.friend.id}`}
            friend={selectedFriend.friend}
            rpc={social.rpc}
            demo={game.demo}
            onClose={() => setSelectedFriend(null)}
          />
        )}
        {panel === "friend" && (
          <FriendSheet
            demo={game.demo}
            onClose={() => setPanel(null)}
            invite={async (name) => {
              await game.mutate("invite_friend", { p_nickname: name });
              tell("Invitation envoyée.");
              setPanel(null);
            }}
          />
        )}
        {panel === "donate" && (
          <DonationSheet
            state={state}
            demo={game.demo}
            onClose={() => setPanel(null)}
            give={async (id, amount, key) => {
              if (game.demo) {
                if (amount >= state.balance)
                  throw new Error("Garde au moins une minute.");
                game.localPatch({ balance: state.balance - amount });
                return;
              }
              await game.mutate("transfer_life", {
                p_recipient: id,
                p_amount: amount,
                p_idempotency_key: key,
              });
            }}
          />
        )}
      </div>
    </MotionConfig>
  );
}
function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}>
      {icon}
      <span>{label}</span>
      <ChevronRight size={17} />
    </button>
  );
}
