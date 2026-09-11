import { parisDay } from "../game";
export const messageReactions = [{id:"clap",emoji:"👏",label:"Bravo"},{id:"strength",emoji:"💪",label:"Courage"},{id:"laugh",emoji:"😂",label:"Drôle"},{id:"heart",emoji:"❤️",label:"J’aime"}] as const;
export type MessageReaction = (typeof messageReactions)[number]["id"];
export type MessageDraft = { body: string; key: string };
export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  idempotency_key?: string;
  reactions?: {user_id:string;reaction:MessageReaction}[];
};
export type MessagePage = { messages: Message[]; has_more: boolean };
export type MessageInbox = {
  enabled: boolean;
  unread_count: number;
  conversations: {
    friend_id: string;
    unread_count: number;
    last_message_at: string | null;
    last_message?: {body:string;sender_id:string;created_at:string} | null;
  }[];
};
export type DemoMessages = { messages: Message[]; enabled: boolean };
export function messageBody(body: string) {
  const value = body.trim();
  if (!value || [...value].length > 2000)
    throw Error("Écris un message de 1 à 2 000 caractères.");
  return value;
}
export function mergeMessages(current: Message[], incoming: Message[]) {
  return [
    ...new Map([...current, ...incoming].map((m) => [m.id, m])).values(),
  ].sort((a, b) =>
    BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0,
  );
}
export function demoMessageRpc<T = unknown>(
  state: DemoMessages,
  user: string,
  friends: string[],
  name: string,
  p: Record<string, unknown> = {},
): { state: DemoMessages; data: T } {
  let next = { ...state, messages: [...state.messages] };
  let data: unknown = null;
  const friend = String(p.p_friend ?? "");
  if (
    [
      "get_friend_messages",
      "send_friend_message",
      "read_friend_messages",
    ].includes(name) &&
    !friends.includes(friend)
  )
    throw Error("Conversation indisponible. Amitié acceptée requise.");
  const pair = (m: Message) =>
    (m.sender_id === user && m.recipient_id === friend) ||
    (m.sender_id === friend && m.recipient_id === user);
  if (name === "get_message_inbox") {
    const conversations = friends.map((friend_id) => ({
      friend_id,
      unread_count: next.messages.filter(
        (m) =>
          m.sender_id === friend_id && m.recipient_id === user && !m.read_at,
      ).length,
      last_message_at:
        next.messages
          .filter(
            (m) =>
              (m.sender_id === friend_id && m.recipient_id === user) ||
              (m.sender_id === user && m.recipient_id === friend_id),
          )
          .at(-1)?.created_at ?? null,
    }));
    for (const conversation of conversations as MessageInbox["conversations"]) {
      const last = mergeMessages([],next.messages.filter(m => (m.sender_id === user && m.recipient_id === conversation.friend_id) || (m.recipient_id === user && m.sender_id === conversation.friend_id))).at(-1);
      conversation.last_message = last ? {body:[...last.body].slice(0,120).join(""),sender_id:last.sender_id,created_at:last.created_at} : null;
    }
    conversations.sort((a,b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "") || a.friend_id.localeCompare(b.friend_id));
    data = {
      enabled: next.enabled,
      conversations,
      unread_count: conversations.reduce((s, c) => s + c.unread_count, 0),
    };
  } else if (name === "get_friend_messages") {
    const all = mergeMessages(
      [],
      next.messages.filter(
        (m) =>
          pair(m) && (!p.p_before || BigInt(m.id) < BigInt(String(p.p_before))),
      ),
    ).reverse();
    data = { messages: all.slice(0, 30), has_more: all.length > 30 };
  } else if (name === "send_friend_message") {
    const body = messageBody(String(p.p_body ?? ""));
    const key = String(p.p_key ?? "");
    if (!key) throw Error("Clé requise.");
    const previous = next.messages.find(
      (m) => m.sender_id === user && m.idempotency_key === key,
    );
    if (previous) {
      if (previous.recipient_id !== friend || previous.body !== body)
        throw Error("Reprise différente.");
      data = previous;
    } else {
      const now = new Date();
      const own = next.messages.filter((m) => m.sender_id === user);
      if (
        own.filter((m) => Date.parse(m.created_at) > now.getTime() - 60000)
          .length >= 20
      )
        throw Error("Patiente une minute.");
      if (
        own.filter((m) => parisDay(m.created_at) === parisDay(now)).length >=
        200
      )
        throw Error("Limite de 200 messages par jour atteinte.");
      const latest = mergeMessages([], next.messages).at(-1);
      const m: Message = {
        id: String(BigInt(latest?.id ?? "0") + 1n),
        sender_id: user,
        recipient_id: friend,
        body,
        created_at: now.toISOString(),
        read_at: null,
        idempotency_key: key,
      };
      next.messages.push(m);
      data = m;
    }
  } else if (name === "read_friend_messages") {
    const ids = Array.isArray(p.p_ids) ? p.p_ids : [];
    next.messages = next.messages.map((m) =>
      pair(m) && m.recipient_id === user && ids.includes(m.id) && !m.read_at
        ? { ...m, read_at: new Date().toISOString() }
        : m,
    );
  } else if (name === "set_message_reaction") {
    const message = next.messages.find(m => m.id === String(p.p_message_id));
    if (!message || ![message.sender_id,message.recipient_id].includes(user) || !friends.includes(message.sender_id === user ? message.recipient_id : message.sender_id)) throw Error("Message indisponible.");
    if (p.p_reaction !== null && !messageReactions.some(r=>r.id === p.p_reaction)) throw Error("Réaction invalide.");
    const reactions = (message.reactions ?? []).filter(r => r.user_id !== user);
    if (p.p_reaction !== null) reactions.push({user_id:user,reaction:p.p_reaction as MessageReaction});
    data = {...message,reactions};
    next.messages = next.messages.map(m => m.id === message.id ? data as Message : m);
  } else if (name === "set_message_notifications")
    next = { ...next, enabled: p.p_enabled === true };
  else throw Error("Opération inconnue.");
  return { state: next, data: data as T };
}
