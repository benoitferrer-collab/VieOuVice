"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import type { Friend } from "@/lib/game";
import type { MessageRpc } from "@/lib/messages/use-messages";
import {
  messageBody,
  messageReactions,
  type MessageReaction,
  mergeMessages,
  type Message,
  type MessageInbox,
  type MessageDraft,
  type MessagePage,
} from "@/lib/messages/rules";

type Props = {
  selectedFriendId: string;
  onSelectFriend: (id:string)=>void;
  drafts: Map<string, MessageDraft>;
  userId: string;
  friends: Friend[];
  demo: boolean;
  inbox: MessageInbox | null;
  rpc: MessageRpc;
  refresh: () => Promise<void>;
};
export function MessageCenter(props: Props) {
  const friendId = props.selectedFriendId;
  const setFriendId = props.onSelectFriend;
  const accepted = props.friends.filter((f) => f.status === "accepted").sort((a,b) => {
    const recent = (id:string) => props.inbox?.conversations.find(c=>c.friend_id === id)?.last_message_at ?? "";
    return recent(b.id).localeCompare(recent(a.id)) || a.nickname.localeCompare(b.nickname);
  });
  const friend = accepted.find((f) => f.id === friendId);
  return (
    <div className="message-center">
      {props.demo && (
        <p className="notice">
          Démo : messages simulés dans cette session, aucun envoi réel.
        </p>
      )}
      {friend ? (
        <Conversation
          key={`${props.userId}:${friend.id}`}
          {...props}
          friend={friend}
          onBack={() => setFriendId("")}
        />
      ) : (
        <>
          <p className="muted">
            Écris à un ami de ton cercle. Les échanges ne rapportent ni minutes
            ni XP.
          </p>
          {accepted.length ? (
            accepted.map((f) => {
              const summary = props.inbox?.conversations.find(c=>c.friend_id === f.id);
              const unread =
                props.inbox?.conversations.find((c) => c.friend_id === f.id)
                  ?.unread_count ?? 0;
              return (
                <button
                  key={f.id}
                  className="message-contact"
                  onClick={() => setFriendId(f.id)}
                >
                  <span className="message-contact-copy"><strong>{f.nickname}</strong>
                    <span className="message-preview">{summary?.last_message ? `${summary.last_message.sender_id === props.userId ? "Toi : " : ""}${summary.last_message.body}` : summary?.last_message_at ? "Ouvrir la conversation" : "Commence la conversation"}</span>
                    {summary?.last_message_at && <time dateTime={summary.last_message_at}>{new Date(summary.last_message_at).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</time>}
                  </span>
                  <span>
                    {unread
                      ? `${unread} non lu${unread > 1 ? "s" : ""}`
                      : "Ouvrir la conversation"}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="empty-copy">
              Ajoute un ami et attends qu’il accepte ton invitation pour
              discuter.
            </p>
          )}
          <MessagePreference
            inbox={props.inbox}
            rpc={props.rpc}
            refresh={props.refresh}
          />
          <p className="fine-print">
            Tes messages sont accessibles à vous deux dans le jeu tant que vous
            êtes amis. Un blocage coupe l’accès et les échanges. Ils restent
            conservés dans les données du compte et son export ; ce service ne
            propose pas de chiffrement de bout en bout.
          </p>
        </>
      )}
    </div>
  );
}
function MessagePreference({
  inbox,
  rpc,
  refresh,
}: Pick<Props, "inbox" | "rpc" | "refresh">) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <label className="setting-row">
        <span>
          <strong>Notifications des messages</strong>
          <span>
            Cloche et alerte téléphone si les notifications du navigateur sont
            activées. Le texte reste dans la conversation.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={inbox?.enabled ?? false}
          disabled={!inbox || busy}
          onChange={async (e) => {
            const enabled = e.target.checked;
            setBusy(true);
            setError("");
            try {
              await rpc("set_message_notifications", { p_enabled: enabled });
              await refresh();
            } catch {
              setError("Préférence non enregistrée. Réessaie.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p role="status" className="feedback coral">
        {error}
      </p>
    </>
  );
}
function Conversation({
  userId,
  demo,
  drafts,
  friend,
  rpc,
  refresh,
  onBack,
}: Props & { friend: Friend; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [more, setMore] = useState(false);
  const [ready, setReady] = useState(false);
  const draftId = `${demo}:${userId}:${friend.id}`;
  const [body, setBody] = useState(() => drafts.get(draftId)?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ body: string; key: string } | null>(
    () => drafts.get(draftId) ?? null,
  );
  const alive = useRef(true);
  const reading = useRef(false);
  const request = useRef(0);
  const invalidate = useCallback(() => {
    request.current++;
  }, []);
  const list = useRef<HTMLOListElement>(null);
  const first = useRef(true);
  const acknowledge = useCallback(
    async (page: MessagePage) => {
      if (document.hidden || !document.hasFocus()) return;
      const ids = page.messages
        .filter((m) => m.recipient_id === userId && !m.read_at)
        .map((m) => m.id);
      if (ids.length) {
        await rpc("read_friend_messages", { p_friend: friend.id, p_ids: ids });
        await refresh();
      }
    },
    [rpc, friend.id, userId, refresh],
  );
  const load = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    const ticket = ++request.current;
    try {
      const page = await rpc<MessagePage>("get_friend_messages", {
        p_friend: friend.id,
        p_before: null,
      });
      if (!alive.current || request.current !== ticket) return;
      setMessages((old) => mergeMessages(old, page.messages));
      setReady(true);
      if (first.current) {
        setMore(page.has_more);
        first.current = false;
      }
      // Only mark the fetched page as read; older pages remain unread until opened.
      await acknowledge(page);
    } catch (e) {
      if (alive.current && request.current === ticket) {
        setMessages([]);
        setReady(false);
        setError(e instanceof Error ? e.message : "Conversation indisponible.");
      }
    } finally {
      reading.current = false;
    }
  }, [rpc, friend.id, acknowledge]);
  useEffect(() => {
    alive.current = true;
    const initial = window.setTimeout(() => void load(), 0);
    const tick = () => {
      if (!document.hidden) void load();
    };
    const timer = setInterval(tick, 10000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive.current = false;
      invalidate();
      window.clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load, invalidate]);
  async function older() {
    const before = messages[0]?.id;
    if (!before || reading.current) return;
    reading.current = true;
    const ticket = ++request.current;
    setPaging(true);
    setError("");
    try {
      const page = await rpc<MessagePage>("get_friend_messages", {
        p_friend: friend.id,
        p_before: before,
      });
      if (!alive.current || request.current !== ticket) return;
      setMessages((old) => mergeMessages(old, page.messages));
      setMore(page.has_more);
      await acknowledge(page);
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      reading.current = false;
      if (alive.current) setPaging(false);
    }
  }
  async function send() {
    if (busy) return;
    let intent = pending;
    try {
      intent ??= { body: messageBody(body), key: crypto.randomUUID() };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message invalide.");
      return;
    }
    drafts.set(draftId, intent);
    setPending(intent);
    setBusy(true);
    setError("");
    try {
      const sent = await rpc<Message>("send_friend_message", {
        p_friend: friend.id,
        p_body: intent.body,
        p_key: intent.key,
      });
      drafts.delete(draftId);
      if (!alive.current) return;
      setMessages((old) => mergeMessages(old, [sent]));
      setBody("");
      setPending(null);
      setReady(true);
      await refresh();
      requestAnimationFrame(() => {
        list.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
      });
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "Envoi non confirmé. Réessaie.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section
      className="conversation"
      aria-label={`Conversation avec ${friend.nickname}`}
    >
      <button
        className="text-button"
        onClick={onBack}
        disabled={busy || !!pending}
      >
        <ArrowLeft size={16} />
        Toutes les conversations
      </button>
      <h3>{friend.nickname}</h3>
      <p className="fine-print">
        Messages privés · actualisation toutes les 10 secondes lorsque le jeu
        est visible.
      </p>
      {more && (
        <button
          className="secondary full"
          disabled={paging}
          onClick={() => void older()}
        >
          {paging ? "Chargement…" : "Voir les messages précédents"}
        </button>
      )}
      {!ready && !error && <p role="status">Chargement de la conversation…</p>}
      {ready && !messages.length && (
        <p className="empty-copy">Pas encore de message. Un petit bonjour ?</p>
      )}
      <ol
        ref={list}
        className="message-list"
        aria-label="Historique des messages"
      >
        {messages.map((m) => (
          <li
            key={m.id}
            className={
              m.sender_id === userId ? "message-bubble mine" : "message-bubble"
            }
          >
            <span className="message-author">
              {m.sender_id === userId ? "Toi" : friend.nickname}
            </span>
            <p>{m.body}</p>
            <time dateTime={m.created_at}>
              {new Date(m.created_at).toLocaleString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
            <MessageReactionBar message={m} userId={userId} rpc={rpc}
              onChange={(updated) => { if (alive.current) setMessages(old=>mergeMessages(old,[updated])); }} />
          </li>
        ))}
      </ol>
      <form
        className="message-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="private-message-body">Ton message</label>
        <textarea
          id="private-message-body"
          rows={3}
          maxLength={2000}
          value={body}
          disabled={busy || !!pending || !ready}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Écris à ton ami…"
        />
        <span className="fine-print">
          {body.length} / 2 000 · 20 messages/minute, 200/jour
        </span>
        {pending && !busy && (
          <p className="notice">
            Envoi non confirmé : réessaie ce même message pour éviter un
            doublon. La reprise reste disponible si tu rouvres cette
            conversation pendant cette session.
          </p>
        )}
        <p role="alert" className="coral feedback">
          {error}
        </p>
        <button
          className="primary full"
          disabled={busy || (!ready && !pending) || (!body.trim() && !pending)}
        >
          {busy ? "Envoi…" : pending ? "Réessayer cet envoi" : "Envoyer"}
          <Send size={16} />
        </button>
        {!ready && (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setError("");
              void load();
            }}
          >
            Actualiser la conversation
          </button>
        )}
      </form>
    </section>
  );
}

function MessageReactionBar({message,userId,rpc,onChange}:{message:Message;userId:string;rpc:MessageRpc;onChange:(message:Message)=>void}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function react(reaction:MessageReaction) {
    if(busy) return;
    setBusy(true);setError("");
    try {
      const own=message.reactions?.find(r=>r.user_id===userId)?.reaction;
      onChange(await rpc<Message>("set_message_reaction",{p_message_id:message.id,p_reaction:own===reaction?null:reaction}));
    } catch(e) {setError(e instanceof Error ? e.message : "Réaction non enregistrée.");}
    finally {setBusy(false);}
  }
  return <><div className="message-reactions" aria-label="Réactions au message">
    {messageReactions.map(r=><button key={r.id} type="button" disabled={busy}
      aria-label={r.label} aria-pressed={message.reactions?.some(v=>v.user_id===userId && v.reaction===r.id) ?? false}
      onClick={()=>void react(r.id)}>{r.emoji}<span>{message.reactions?.filter(v=>v.reaction===r.id).length || ""}</span></button>)}
  </div>{error && <p className="coral" role="alert">{error}</p>}</>;
}
