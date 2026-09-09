"use client";

import { useRef, useState } from "react";
import { REACTIONS } from "@/lib/progression/metadata";
import type {
  Encouragement,
  Reaction,
  ReactionsProps,
} from "@/lib/progression/types";
import "./progression.css";

export function Reactions({ value, rpc, onChanged }: ReactionsProps) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{
    message: string;
    reaction: Reaction | null;
  } | null>(null);

  async function react(reaction: Reaction | null) {
    if (lock.current || !value.can_react) return;
    lock.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const result = await rpc<Encouragement>("set_action_reaction", {
        p_action_id: value.action_id,
        p_reaction: reaction,
      });
      onChanged(result);
    } catch (caught) {
      setFailure({
        reaction,
        message:
          caught instanceof Error
            ? caught.message
            : "Ton encouragement n’a pas pu être enregistré.",
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="encouragements" aria-busy={busy}>
      <div
        className="encouragement-buttons"
        role="group"
        aria-label="Encouragements"
      >
        {REACTIONS.map(({ code, emoji, label }) => (
          <button
            key={code}
            type="button"
            aria-label={`${label} : ${value.counts[code]} encouragement${value.counts[code] === 1 ? "" : "s"}`}
            aria-pressed={value.mine === code}
            disabled={busy || !value.can_react}
            onClick={() => void react(value.mine === code ? null : code)}
          >
            <span aria-hidden="true">{emoji}</span>
            <span>{value.counts[code]}</span>
          </button>
        ))}
      </div>
      {busy && <small role="status">Enregistrement…</small>}
      {failure && (
        <div className="progression-error" role="alert">
          <p>{failure.message}</p>
          <button
            type="button"
            className="progression-retry"
            disabled={busy || !value.can_react}
            onClick={() => void react(failure.reaction)}
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}
