"use client";
import { useState } from "react";
import { readTransferDraft, writeTransferDraft } from "@/lib/transfer-draft";
import { Heart } from "lucide-react";
import type { GameState } from "@/lib/game";
import { Sheet } from "./sheet";

export function DonationSheet({
  state,
  demo,
  onClose,
  give,
}: {
  state: GameState;
  demo: boolean;
  onClose: () => void;
  give: (id: string, amount: number, key: string) => Promise<void>;
}) {
  const [initial] = useState(() => (demo ? null : readTransferDraft(state.id)));
  const [recipient, setRecipient] = useState(
    initial?.id || state.friends.find((f) => f.status === "accepted")?.id || "",
  );
  const [amount, setAmount] = useState(initial?.amount || 25);
  const [intent, setIntent] = useState<{
    id: string;
    amount: number;
    key: string;
  } | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return (
    <Sheet
      title="Un petit supplément de vie"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {done ? (
        <div className="action-success">
          <Heart size={40} className="lime" />
          <h3>Coup de pouce envoyé.</h3>
          <p>
            {demo
              ? "Don simulé. Seul ton solde de démo est modifié."
              : "Le don est confirmé. Aucun point de ligue n’a été ajouté."}
          </p>
          <button className="primary full" onClick={onClose}>
            C’est tout bon
          </button>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const pending = intent || {
              id: recipient,
              amount,
              key: crypto.randomUUID(),
            };
            if (busy) return;
            setIntent(pending);
            if (!demo) writeTransferDraft(state.id, pending);
            setBusy(true);
            try {
              await give(pending.id, pending.amount, pending.key);
              if (!demo) writeTransferDraft(state.id, null);
              setDone(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Don non confirmé.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            À qui ?
            <select
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={busy || !!intent}
              required
            >
              <option value="">Choisir un ami</option>
              {state.friends
                .filter((f) => f.status === "accepted")
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nickname}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Minutes de vie
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              disabled={busy || !!intent}
              required
            />
          </label>
          <p className="notice">
            De 1 à 100 minutes. Tu gardes au moins une minute. Plafond quotidien
            : 200 minutes ; compte de plus de 24 h requis en mode connecté.
          </p>
          <p className="coral" role="alert">
            {error}
          </p>
          <button className="primary full" disabled={busy || !recipient}>
            {busy
              ? "Confirmation…"
              : intent
                ? "Réessayer ce don"
                : "Confirmer le don"}
            <Heart size={18} />
          </button>
        </form>
      )}
    </Sheet>
  );
}
