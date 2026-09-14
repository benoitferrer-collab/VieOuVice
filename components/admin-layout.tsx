"use client";
import { Children, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export function AdminRow({
  title,
  meta,
  children,
  leading,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <details className="admin-row" name="admin-record">
      <summary>
        {leading}
        <span>
          <strong>{title}</strong>
          {meta && <small>{meta}</small>}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="admin-row-body">{children}</div>
    </details>
  );
}
export function AdminCollection({
  children,
  label,
  disabled = false,
  size = 5,
}: {
  children: ReactNode;
  label: string;
  disabled?: boolean;
  size?: number;
}) {
  const [requested, setRequested] = useState(0);
  const rows = Children.toArray(children),
    count = Math.max(1, Math.ceil(rows.length / size)),
    page = Math.min(requested, count - 1);
  return (
    <div className="admin-collection">
      <div className="admin-list-meta">
        <span>
          {rows.length} {label}
        </span>
        {count > 1 && (
          <span>
            Page {page + 1} / {count}
          </span>
        )}
      </div>
      <div className="events-admin-list">
        {rows.slice(page * size, (page + 1) * size)}
      </div>
      {count > 1 && (
        <nav className="admin-pagination" aria-label={`Pages : ${label}`}>
          <button
            type="button"
            className="secondary"
            disabled={disabled || page === 0}
            onClick={() => setRequested(page - 1)}
          >
            <ChevronLeft size={16} />
            Précédent
          </button>
          <button
            type="button"
            className="secondary"
            disabled={disabled || page === count - 1}
            onClick={() => setRequested(page + 1)}
          >
            Suivant
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
