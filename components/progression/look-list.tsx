"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { HubRpc } from "@/lib/events/types";
import type { PlayerLook } from "@/lib/progression/types";
export function LookList({
  ids,
  rpc,
  children,
}: {
  ids: string[];
  rpc?: HubRpc;
  children: (looks: Record<string, PlayerLook>) => ReactNode;
}) {
  const key = ids.join(",");
  const [result, setResult] = useState<{
    key: string;
    rpc?: HubRpc;
    looks: Record<string, PlayerLook>;
  }>({ key: "", looks: {} });
  useEffect(() => {
    let active = true;
    if (!rpc) return;
    void (async () => {
      const looks: Record<string, PlayerLook> = {};
      const requested = key ? key.split(",") : [];
      try {
        for (let i = 0; i < requested.length; i += 60)
          for (const row of await rpc<PlayerLook[]>("get_player_looks", {
            p_user_ids: requested.slice(i, i + 60),
          }))
            looks[row.user_id] = row;
        if (active) setResult({ key, rpc, looks });
      } catch {
        if (active) setResult({ key, rpc, looks: {} });
      }
    })();
    return () => {
      active = false;
    };
  }, [key, rpc]);
  return children(result.key === key && result.rpc === rpc ? result.looks : {});
}
