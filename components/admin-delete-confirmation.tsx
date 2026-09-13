"use client";

import { useRef, useState } from "react";

export function AdminDeleteConfirmation({
  name,
  description,
  disabled,
  onConfirm,
}: {
  name: string;
  description: string;
  disabled: boolean;
  onConfirm: (confirmation: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const running = useRef(false);
  if (!open)
    return (
      <button
        type="button"
        className="events-danger"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={`Supprimer définitivement ${name}`}
      >
        Supprimer définitivement
      </button>
    );
  return (
    <form
      className="admin-delete-confirmation"
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled || running.current || confirmation !== name) return;
        running.current = true;
        try {
          if (await onConfirm(confirmation)) {
            setOpen(false);
            setConfirmation("");
          }
        } finally {
          running.current = false;
        }
      }}
    >
      <strong>Supprimer définitivement « {name} » ?</strong>
      <p>{description} Cette suppression est irréversible.</p>
      <label>
        Recopie « {name} » pour confirmer
        <input
          value={confirmation}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          maxLength={80}
          onChange={(e) => setConfirmation(e.target.value)}
        />
      </label>
      <div className="events-admin-actions">
        <button
          className="secondary"
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen(false);
            setConfirmation("");
          }}
        >
          Conserver
        </button>
        <button
          className="events-danger"
          type="submit"
          disabled={disabled || confirmation !== name}
        >
          {disabled ? "Suppression…" : "Confirmer la suppression"}
        </button>
      </div>
    </form>
  );
}
