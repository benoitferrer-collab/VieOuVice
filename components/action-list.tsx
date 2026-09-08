"use client";
import { BookOpen } from "lucide-react";
import { catalog, signed, type Action } from "@/lib/game";
import { ActionIcon } from "./action-icon";

export function ActionList({ actions }: { actions: Action[] }) {
  if (!actions.length)
    return (
      <div className="empty-state">
        <BookOpen size={28} />
        <p>La page est blanche. À toi d’écrire la suite.</p>
      </div>
    );
  return (
    <div className="action-list">
      {actions.map((a) => (
        <div className="action-row" key={a.id}>
          <span className={"action-icon " + a.kind}>
            <ActionIcon
              name={
                catalog.find((c) => c.id === a.catalog_id)?.icon || "activity"
              }
            />
          </span>
          <div>
            <strong>{a.label}</strong>
            <span>
              {new Intl.DateTimeFormat("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(a.created_at))}{" "}
              · ×{a.quantity}
            </span>
          </div>
          <b className={a.kind === "health" ? "lime" : "coral"}>
            {signed(a.minutes_impact)}
            <small> min</small>
          </b>
        </div>
      ))}
    </div>
  );
}
