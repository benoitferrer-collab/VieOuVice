"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Sheet } from "./sheet";

export function FriendSheet({
  demo,
  onClose,
  invite,
}: {
  demo: boolean;
  onClose: () => void;
  invite: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Agrandir le cercle" onClose={onClose}>
      <p className="muted">
        Entre le pseudonyme exact de ton ami. Il pourra accepter ton invitation.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await invite(name);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Invitation impossible.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Pseudonyme
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Le pseudo de ton ami"
            required
            minLength={3}
            maxLength={20}
          />
        </label>
        {demo && (
          <p className="notice">
            Les invitations réelles nécessitent un compte connecté. Les amis de
            cette démo sont fictifs.
          </p>
        )}
        <p role="alert" className="coral">
          {error}
        </p>
        <button className="primary full" disabled={busy || demo}>
          {busy ? "Envoi…" : "Envoyer une invitation"}
          <ArrowRight size={18} />
        </button>
      </form>
    </Sheet>
  );
}
