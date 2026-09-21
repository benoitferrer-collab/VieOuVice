"use client";

import { useEffect, useState, useRef } from "react";
import {
  CalendarDays,
  FileClock,
  ListChecks,
  Search,
  ShieldCheck,
  Users,
  Sparkles,
  Handshake,
} from "lucide-react";
import type {
  AdminDashboard,
  AdminPanelProps,
  AdminUser,
  CompetitionDraft,
  CompetitionSummary,
} from "@/lib/events/types";
import { competitionDraftSchema } from "@/lib/events/validation";
import { competitionPhase } from "@/lib/events/rules";
import { AdminDeleteConfirmation } from "./admin-delete-confirmation";
import { AdminCooperative } from "./admin-cooperative";
import { EmojiWorkshop } from "./emojis/emoji-workshop";
import { deleteAccount } from "@/lib/admin/delete-account-client";
import { AdminSeasonIdentity } from "./admin-season-identity";
import { AdminRow, AdminCollection } from "./admin-layout";
import { AIWorkshop } from "./ai-workshop";
import { Sheet } from "./sheet";
import "./events.css";

type AdminTab =
  "events" | "users" | "catalog" | "audit" | "cooperative" | "emojis";

const emptyDraft: CompetitionDraft = {
  id: null,
  title: "",
  description: "",
  starts_at: "",
  ends_at: "",
  metric: "health_minutes",
  catalog_id: null,
  badge_label: "",
  badge_icon: "trophy",
};

const adminDate = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function toLocalInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

export function AdminPanel({ userId, rpc, changed, onClose }: AdminPanelProps) {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [tab, setTab] = useState<AdminTab>("events");
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.closest("dialog")?.scrollTo({ top: 0 });
  }, [tab]);
  const [proposal, setProposal] = useState<CompetitionDraft | null>(null);
  const [studio, setStudio] = useState<"challenges" | "seasons" | "emojis">(
    "challenges",
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  async function loadDashboard(query = appliedSearch, offset = 0) {
    const page = await rpc<AdminDashboard>("admin_get_dashboard", {
      p_search: query,
      p_offset: offset,
    });
    setDashboard((current) =>
      offset > 0 && current
        ? { ...page, users: [...current.users, ...page.users] }
        : page,
    );
  }

  useEffect(() => {
    let active = true;
    rpc<AdminDashboard>("admin_get_dashboard", {
      p_search: "",
      p_offset: 0,
    })
      .then((result) => {
        if (active) setDashboard(result);
      })
      .catch((caught) => {
        if (active)
          setError(
            errorMessage(caught, "Le tableau de bord est indisponible."),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [rpc]);

  async function mutate(
    key: string,
    action: () => Promise<unknown>,
    message: string,
  ) {
    if (busy) return false;
    setBusy(key);
    setError("");
    setNotice("");
    let applied = false;
    try {
      await action();
      applied = true;
      await loadDashboard();
      await changed();
      setNotice(message);
      return true;
    } catch (caught) {
      if (applied) {
        setNotice(message);
        setError(
          "L’action est confirmée, mais l’actualisation a échoué. Rouvre ce menu pour recharger les données.",
        );
        return true;
      }
      setError(
        errorMessage(caught, "La modification n’a pas été enregistrée."),
      );
      return false;
    } finally {
      setBusy("");
    }
  }

  return (
    <Sheet
      className="admin-sheet"
      title="Administration"
      onClose={() => !busy && onClose()}
    >
      <div
        className="events-admin-tabs"
        role="tablist"
        aria-label="Administration"
      >
        {(
          [
            ["events", "Événements", CalendarDays],
            ["cooperative", "Coopération", Handshake],
            ["users", "Joueurs", Users],
            ["emojis", "Studio IA", Sparkles],
            ["catalog", "Catalogue", ListChecks],
            ["audit", "Journal", FileClock],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            type="button"
            role="tab"
            id={`events-admin-tab-${id}`}
            aria-controls={`events-admin-panel-${id}`}
            aria-selected={tab === id}
            className={tab === id ? "selected" : ""}
            key={id}
            disabled={!!busy}
            onClick={() => {
              setProposal(null);
              setTab(id);
              setError("");
              setNotice("");
            }}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="events-loading" role="status">
          <span className="loader" />
          Chargement de l’administration…
        </div>
      ) : dashboard ? (
        <div
          ref={panelRef}
          role="tabpanel"
          id={`events-admin-panel-${tab}`}
          aria-labelledby={`events-admin-tab-${tab}`}
        >
          {tab === "events" && (
            <AdminEvents
              initialDraft={proposal}
              events={dashboard.events}
              catalog={dashboard.catalog}
              busy={busy}
              mutate={mutate}
              rpc={rpc}
            />
          )}
          {tab === "users" && (
            <AdminUsers
              users={dashboard.users}
              userId={userId}
              search={search}
              setSearch={setSearch}
              nextOffset={dashboard.next_offset}
              busy={busy}
              onSearch={async () => {
                if (busy) return;
                setBusy("search");
                setError("");
                setAppliedSearch(search.trim());
                try {
                  await loadDashboard(search.trim(), 0);
                } catch (caught) {
                  setError(errorMessage(caught, "La recherche a échoué."));
                } finally {
                  setBusy("");
                }
              }}
              onMore={async () => {
                if (dashboard.next_offset === null || busy) return;
                setBusy("users-more");
                setError("");
                try {
                  await loadDashboard(appliedSearch, dashboard.next_offset);
                } catch (caught) {
                  setError(errorMessage(caught, "La suite est indisponible."));
                } finally {
                  setBusy("");
                }
              }}
              mutate={mutate}
              rpc={rpc}
            />
          )}
          {tab === "catalog" && (
            <AdminCatalog
              catalog={dashboard.catalog}
              busy={busy}
              mutate={mutate}
              rpc={rpc}
            />
          )}
          {tab === "cooperative" && (
            <AdminCooperative rpc={rpc} busy={busy} mutate={mutate} />
          )}
          {tab === "emojis" && (
            <div className="events-admin-view">
              <div className="admin-studio-tabs" aria-label="Outils IA">
                {(
                  [
                    ["challenges", "Défis"],
                    ["seasons", "Saisons"],
                    ["emojis", "Emojis"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={studio === id ? "selected" : ""}
                    aria-pressed={studio === id}
                    onClick={() => setStudio(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {studio === "challenges" && (
                <AIWorkshop
                  userId={userId}
                  rpc={rpc}
                  onChoose={(draft) => {
                    setProposal(draft);
                    setTab("events");
                  }}
                />
              )}
              {studio === "seasons" && <AdminSeasonIdentity rpc={rpc} />}{" "}
              {studio === "emojis" && (
                <EmojiWorkshop userId={userId} rpc={rpc} />
              )}
            </div>
          )}
          {tab === "audit" && <AdminAudit dashboard={dashboard} />}
        </div>
      ) : (
        <div className="events-empty">
          <ShieldCheck size={28} aria-hidden="true" />
          <p>Le tableau de bord ne peut pas être affiché.</p>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              setLoading(true);
              setError("");
              try {
                await loadDashboard("", 0);
              } catch (caught) {
                setError(errorMessage(caught, "Le chargement a échoué."));
              } finally {
                setLoading(false);
              }
            }}
          >
            Réessayer
          </button>
        </div>
      )}
      {error && (
        <p className="events-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="events-notice" role="status">
          {notice}
        </p>
      )}
    </Sheet>
  );
}

function AdminEvents({
  initialDraft,
  events,
  catalog,
  busy,
  mutate,
  rpc,
}: {
  initialDraft: CompetitionDraft | null;
  events: AdminDashboard["events"];
  catalog: AdminDashboard["catalog"];
  busy: string;
  mutate: (
    key: string,
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<boolean>;
  rpc: AdminPanelProps["rpc"];
}) {
  const [editing, setEditing] = useState(!!initialDraft);
  const [draft, setDraft] = useState<CompetitionDraft>(
    initialDraft ?? emptyDraft,
  );
  const [validationError, setValidationError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [filter, setFilter] = useState("");
  const filtered = events.filter((e) =>
    e.title.toLocaleLowerCase("fr").includes(filter.toLocaleLowerCase("fr")),
  );

  function update(patch: Partial<CompetitionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setRequestId("");
    setValidationError("");
  }

  function edit(event?: CompetitionSummary) {
    setDraft(
      event
        ? {
            id: event.id,
            title: event.title,
            description: event.description,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            metric: event.metric,
            catalog_id: event.catalog_id,
            badge_label: event.badge_label,
            badge_icon: event.badge_icon,
          }
        : emptyDraft,
    );
    setRequestId("");
    setValidationError("");
    setEditing(true);
  }

  if (editing) {
    return (
      <form
        className="events-admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          const normalized = {
            ...draft,
            catalog_id:
              draft.metric === "category_minutes" ? draft.catalog_id : null,
          };
          const parsed = competitionDraftSchema.safeParse(normalized);
          if (!parsed.success) {
            setValidationError(
              parsed.error.issues[0]?.message ??
                "Vérifie les informations saisies.",
            );
            return;
          }
          const stableRequestId = requestId || crypto.randomUUID();
          setRequestId(stableRequestId);
          void mutate(
            "event-save",
            () =>
              rpc("admin_save_competition", {
                p_event: parsed.data,
                p_request_id: stableRequestId,
              }),
            draft.id ? "Brouillon mis à jour." : "Brouillon créé.",
          ).then((saved) => {
            if (saved) setEditing(false);
          });
        }}
      >
        <div className="events-subheading">
          <h3>{draft.id ? "Modifier le brouillon" : "Nouvel événement"}</h3>
          <button
            type="button"
            className="text-button"
            disabled={!!busy}
            onClick={() => setEditing(false)}
          >
            Annuler
          </button>
        </div>
        <label>
          Titre
          <input
            value={draft.title}
            maxLength={80}
            required
            disabled={!!busy}
            onChange={(e) => update({ title: e.target.value })}
          />
        </label>
        <label>
          Description
          <textarea
            value={draft.description}
            maxLength={1200}
            disabled={!!busy}
            onChange={(e) => update({ description: e.target.value })}
          />
        </label>
        <div className="events-form-grid">
          <label>
            Début
            <input
              type="datetime-local"
              value={toLocalInput(draft.starts_at)}
              required
              disabled={!!busy}
              onChange={(e) =>
                update({ starts_at: fromLocalInput(e.target.value) })
              }
            />
          </label>
          <label>
            Fin
            <input
              type="datetime-local"
              value={toLocalInput(draft.ends_at)}
              required
              disabled={!!busy}
              onChange={(e) =>
                update({ ends_at: fromLocalInput(e.target.value) })
              }
            />
          </label>
        </div>
        <label>
          Objectif du classement
          <select
            value={draft.metric}
            disabled={!!busy}
            onChange={(e) =>
              update({ metric: e.target.value as CompetitionDraft["metric"] })
            }
          >
            <option value="health_minutes">
              Top bonnes actions · minutes gagnées
            </option>
            <option value="excess_minutes">
              Top petits écarts · minutes perdues
            </option>
            <option value="net_minutes">
              Meilleur bilan net · gains moins pertes
            </option>
            <option value="category_minutes">Catégorie saine</option>
          </select>
        </label>
        <p className="admin-metric-help">
          {draft.metric === "excess_minutes"
            ? "Le plus grand total de minutes fictives perdues arrive premier. Les bonnes actions ne réduisent pas ce score."
            : draft.metric === "net_minutes"
              ? "Le meilleur solde arrive premier : minutes gagnées moins minutes perdues."
              : "Le plus grand total de minutes gagnées arrive premier. Les petits écarts ne réduisent pas ce score."}{" "}
          Seules les actions déclarées pendant l’événement et après
          l’inscription comptent.
        </p>
        {draft.metric === "category_minutes" && (
          <label>
            Catégorie saine
            <select
              value={draft.catalog_id ?? ""}
              required
              disabled={!!busy}
              onChange={(e) => update({ catalog_id: e.target.value || null })}
            >
              <option value="">Choisir une catégorie</option>
              {catalog
                .filter((item) => item.kind === "health" && item.active)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                  </option>
                ))}
            </select>
          </label>
        )}
        <div className="events-form-grid">
          <label>
            Nom du badge
            <input
              value={draft.badge_label}
              maxLength={60}
              required
              disabled={!!busy}
              onChange={(e) => update({ badge_label: e.target.value })}
            />
          </label>
          <label>
            Icône
            <select
              value={draft.badge_icon}
              disabled={!!busy}
              onChange={(e) =>
                update({
                  badge_icon: e.target.value as CompetitionDraft["badge_icon"],
                })
              }
            >
              <option value="trophy">Trophée</option>
              <option value="medal">Médaille</option>
              <option value="leaf">Feuille</option>
              <option value="flame">Flamme</option>
            </select>
          </label>
        </div>
        {validationError && (
          <p className="events-error" role="alert">
            {validationError}
          </p>
        )}
        <button className="primary full" disabled={!!busy}>
          {busy === "event-save"
            ? "Enregistrement…"
            : "Enregistrer le brouillon"}
        </button>
      </form>
    );
  }

  return (
    <div className="events-admin-view">
      <div className="admin-event-toolbar">
        <button
          type="button"
          className="primary"
          disabled={!!busy}
          onClick={() => edit()}
        >
          Nouvel événement
        </button>
        <label className="admin-filter">
          Rechercher un événement
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Nom de l’événement…"
          />
        </label>
      </div>
      <AdminCollection key={filter} label="événements" disabled={!!busy}>
        {filtered.map((event) => {
          const phase = competitionPhase(event);
          return (
            <AdminRow
              key={event.id}
              title={event.title}
              meta={`${{ draft: "Brouillon", cancelled: "Annulé", completed: "Terminé", upcoming: "À venir", active: "En cours", ended: "À clôturer" }[phase]} · ${event.participant_count} inscrits`}
            >
              <div className="events-subheading">
                <div>
                  <span className={`events-phase events-phase-${phase}`}>
                    {
                      {
                        draft: "Brouillon",
                        cancelled: "Annulé",
                        completed: "Terminé",
                        upcoming: "À venir",
                        active: "En cours",
                        ended: "Clôture en cours",
                      }[phase]
                    }
                  </span>
                  <h3>{event.title}</h3>
                </div>
                <span>
                  {event.participant_count} inscrit
                  {event.participant_count > 1 ? "s" : ""}
                </span>
              </div>
              <p>
                {adminDate.format(new Date(event.starts_at))} →{" "}
                {adminDate.format(new Date(event.ends_at))}
              </p>
              <div className="events-admin-actions">
                {event.status === "draft" && (
                  <>
                    <button
                      type="button"
                      className="secondary"
                      disabled={!!busy}
                      onClick={() => edit(event)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="primary"
                      disabled={!!busy}
                      onClick={() =>
                        void mutate(
                          `publish-${event.id}`,
                          () =>
                            rpc("admin_set_competition_status", {
                              p_event_id: event.id,
                              p_status: "published",
                            }),
                          "Événement publié.",
                        )
                      }
                    >
                      {busy === `publish-${event.id}`
                        ? "Publication…"
                        : "Publier"}
                    </button>
                  </>
                )}
                {(event.status === "draft" || event.status === "published") && (
                  <button
                    type="button"
                    className="events-danger"
                    disabled={!!busy}
                    onClick={() =>
                      void mutate(
                        `cancel-${event.id}`,
                        () =>
                          rpc("admin_set_competition_status", {
                            p_event_id: event.id,
                            p_status: "cancelled",
                          }),
                        "Événement annulé.",
                      )
                    }
                  >
                    {busy === `cancel-${event.id}` ? "Annulation…" : "Annuler"}
                  </button>
                )}
              </div>
              <AdminDeleteConfirmation
                name={event.title}
                description="Les inscriptions, classements et badges de cette compétition seront effacés. Les actions et XP déjà acquis restent aux joueurs."
                disabled={!!busy}
                onConfirm={(confirmation) =>
                  mutate(
                    `event-delete-${event.id}`,
                    () =>
                      rpc("admin_delete_challenge", {
                        p_kind: "competition",
                        p_id: event.id,
                        p_confirmation: confirmation,
                      }),
                    "Compétition supprimée.",
                  )
                }
              />
            </AdminRow>
          );
        })}
      </AdminCollection>
      {!filtered.length && (
        <p className="events-empty">Aucun événement trouvé.</p>
      )}
    </div>
  );
}

function AdminUsers({
  users,
  userId,
  search,
  setSearch,
  nextOffset,
  busy,
  onSearch,
  onMore,
  mutate,
  rpc,
}: {
  users: AdminUser[];
  userId: string;
  search: string;
  setSearch: (value: string) => void;
  nextOffset: number | null;
  busy: string;
  onSearch: () => Promise<void>;
  onMore: () => Promise<void>;
  mutate: (
    key: string,
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<boolean>;
  rpc: AdminPanelProps["rpc"];
}) {
  return (
    <div className="events-admin-view">
      <form
        className="events-search"
        onSubmit={(event) => {
          event.preventDefault();
          void onSearch();
        }}
      >
        <label>
          <span className="sr-only">Rechercher un joueur</span>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Pseudo ou e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!!busy}
          />
        </label>
        <button className="secondary" disabled={!!busy}>
          {busy === "search" ? "Recherche…" : "Rechercher"}
        </button>
      </form>
      <AdminCollection key={search} label="joueurs chargés" disabled={!!busy}>
        {users.map((user) => (
          <AdminUserRow
            key={user.id}
            user={user}
            actorId={userId}
            self={user.id === userId}
            busy={busy}
            mutate={mutate}
            rpc={rpc}
          />
        ))}
      </AdminCollection>
      {!users.length && <p className="events-empty">Aucun joueur trouvé.</p>}
      {nextOffset !== null && (
        <button
          type="button"
          className="secondary full"
          disabled={!!busy}
          onClick={() => void onMore()}
        >
          {busy === "users-more" ? "Chargement…" : "Charger d’autres joueurs"}
        </button>
      )}
    </div>
  );
}

function AdminUserRow({
  actorId,
  user,
  self,
  busy,
  mutate,
  rpc,
}: {
  actorId: string;
  user: AdminUser;
  self: boolean;
  busy: string;
  mutate: (
    key: string,
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<boolean>;
  rpc: AdminPanelProps["rpc"];
}) {
  const [isAdmin, setIsAdmin] = useState(user.is_admin);
  const [suspended, setSuspended] = useState(user.suspended);
  const [reason, setReason] = useState("");
  const changed = isAdmin !== user.is_admin || suspended !== user.suspended;
  return (
    <AdminRow
      title={user.nickname}
      meta={`${user.is_admin ? "Administrateur" : "Joueur"}${user.suspended ? " · Suspendu" : ""}${self ? " · Ton compte" : ""}`}
    >
      <div className="events-subheading">
        <div>
          <h3>{user.nickname}</h3>
          <p>{user.email}</p>
        </div>
        {self && <span>Ton compte</span>}
      </div>
      <div className="events-switches">
        <label>
          <span>Administrateur</span>
          <input
            type="checkbox"
            role="switch"
            checked={isAdmin}
            disabled={!!busy}
            onChange={(e) => setIsAdmin(e.target.checked)}
          />
        </label>
        <label>
          <span>Compte suspendu</span>
          <input
            type="checkbox"
            role="switch"
            checked={suspended}
            disabled={!!busy || self}
            aria-describedby={self ? `self-${user.id}` : undefined}
            onChange={(e) => setSuspended(e.target.checked)}
          />
        </label>
      </div>
      {self && (
        <small id={`self-${user.id}`}>
          Tu ne peux pas suspendre ton propre compte.
        </small>
      )}
      <label>
        Motif de la modification
        <input
          value={reason}
          maxLength={250}
          required={changed}
          disabled={!!busy}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motif visible dans le journal"
        />
      </label>
      <button
        type="button"
        className="secondary full"
        aria-label={`Enregistrer les droits de ${user.nickname}`}
        disabled={!!busy || !changed || !reason.trim()}
        onClick={() =>
          void mutate(
            `user-${user.id}`,
            () =>
              rpc("admin_update_user", {
                p_user_id: user.id,
                p_is_admin: isAdmin,
                p_suspended: suspended,
                p_reason: reason.trim(),
              }),
            "Compte mis à jour.",
          )
        }
      >
        {busy === `user-${user.id}` ? "Enregistrement…" : "Enregistrer"}
      </button>
      {!self && (
        <AdminDeleteConfirmation
          name={user.nickname}
          description="Son accès, son profil, ses actions, messages, scores et récompenses seront effacés, ainsi que les missions coopératives qu’il a créées et leurs badges. Ses catégories partagées resteront anonymisées."
          disabled={!!busy}
          onConfirm={(confirmation) =>
            mutate(
              `user-delete-${user.id}`,
              () => deleteAccount(actorId, user.id, confirmation),
              "Compte et données du joueur supprimés définitivement.",
            )
          }
        />
      )}
    </AdminRow>
  );
}

function AdminCatalog({
  catalog,
  busy,
  mutate,
  rpc,
}: {
  catalog: AdminDashboard["catalog"];
  busy: string;
  mutate: (
    key: string,
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<boolean>;
  rpc: AdminPanelProps["rpc"];
}) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const filtered = catalog.filter((c) =>
    c.label.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")),
  );
  return (
    <div className="events-admin-view">
      <label className="admin-filter">
        Rechercher une action
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nom de l’action…"
        />
      </label>
      <AdminCollection key={query} label="actions" disabled={!!busy}>
        {filtered.map((item) => (
          <AdminRow
            key={item.id}
            title={item.label}
            meta={`${item.active ? "Actif" : "Inactif"} · ${item.coefficient > 0 ? "+" : ""}${item.coefficient} min`}
          >
            <div className="events-subheading">
              <div>
                <h3>{item.label}</h3>
                <p>
                  {item.kind === "health" ? "Bonne habitude" : "Petit écart"} ·{" "}
                  {item.coefficient > 0 ? "+" : ""}
                  {item.coefficient} min
                </p>
              </div>
              <span
                className={item.active ? "events-active" : "events-inactive"}
              >
                {item.active ? "Actif" : "Inactif"}
              </span>
            </div>
            <label>
              Motif
              <input
                value={reasons[item.id] ?? ""}
                maxLength={250}
                disabled={!!busy}
                onChange={(e) =>
                  setReasons((current) => ({
                    ...current,
                    [item.id]: e.target.value,
                  }))
                }
                placeholder={
                  item.active
                    ? "Pourquoi le désactiver ?"
                    : "Pourquoi le réactiver ?"
                }
              />
            </label>
            <button
              type="button"
              aria-label={`${item.active ? "Désactiver" : "Réactiver"} ${item.label}`}
              className={item.active ? "events-danger full" : "secondary full"}
              disabled={!!busy || !(reasons[item.id] ?? "").trim()}
              onClick={() =>
                void mutate(
                  `catalog-${item.id}`,
                  () =>
                    rpc("admin_set_catalog_active", {
                      p_catalog_id: item.id,
                      p_active: !item.active,
                      p_reason: reasons[item.id].trim(),
                    }),
                  item.active ? "Élément désactivé." : "Élément réactivé.",
                )
              }
            >
              {busy === `catalog-${item.id}`
                ? "Enregistrement…"
                : item.active
                  ? "Désactiver"
                  : "Réactiver"}
            </button>
          </AdminRow>
        ))}
      </AdminCollection>
      {!filtered.length && <p>Aucune action trouvée.</p>}
    </div>
  );
}

function AdminAudit({ dashboard }: { dashboard: AdminDashboard }) {
  return dashboard.audit.length ? (
    <AdminCollection label="actions récentes">
      {dashboard.audit.map((entry) => (
        <AdminRow
          key={entry.id}
          title={entry.action}
          meta={adminDate.format(new Date(entry.created_at))}
        >
          <div className="events-subheading">
            <strong>{entry.action}</strong>
            <time dateTime={entry.created_at}>
              {adminDate.format(new Date(entry.created_at))}
            </time>
          </div>
          <p>Cible : {entry.target_id}</p>
          <p>{entry.reason || "Aucun motif renseigné."}</p>
          <small>Par {entry.actor_id}</small>
        </AdminRow>
      ))}
    </AdminCollection>
  ) : (
    <p className="events-empty">Aucune action administrative récente.</p>
  );
}
