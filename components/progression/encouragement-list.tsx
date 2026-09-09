"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { HubRpc } from "@/lib/events/types";
import type { Encouragement } from "@/lib/progression/types";
import { Reactions } from "./reactions";
export function EncouragementList({
  ids,
  rpc,
  children,
}: {
  ids: string[];
  rpc: HubRpc;
  children: (render: (id: string) => ReactNode) => ReactNode;
}) {
  const key = ids.join(",");
  const [result, setResult] = useState<{
    key: string;
    rows: Record<string, Encouragement>;
    error: string;
  }>({ key: "", rows: {}, error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const rows: Record<string, Encouragement> = {};
        const requested = key ? key.split(",") : [];
        for (let i = 0; i < requested.length; i += 50) {
          const data = await rpc<Encouragement[]>("get_encouragements", {
            p_action_ids: requested.slice(i, i + 50),
          });
          for (const row of data) rows[row.action_id] = row;
        }
        if (active) setResult({ key, rows, error: "" });
      } catch (error) {
        if (active)
          setResult({
            key,
            rows: {},
            error:
              error instanceof Error
                ? error.message
                : "Encouragements indisponibles.",
          });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [key, rpc, retry]);
  const render = (id: string) =>
    result.key === key && result.rows[id] ? (
      <Reactions
        value={result.rows[id]}
        rpc={rpc}
        onChanged={(value) =>
          setResult((old) => ({ ...old, rows: { ...old.rows, [id]: value } }))
        }
      />
    ) : null;
  return (
    <>
      {children(render)}
      {result.key === key && result.error && (
        <p role="alert" className="progression-error">
          {result.error}{" "}
          <button
            className="text-button"
            onClick={() => setRetry((r) => r + 1)}
          >
            Réessayer
          </button>
        </p>
      )}
    </>
  );
}
