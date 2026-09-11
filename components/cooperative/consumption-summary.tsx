"use client";
import { useEffect, useState } from "react";
import type { HubRpc } from "@/lib/events/types";
import type { ConsumptionSummary } from "@/lib/cooperative/types";
export function ConsumptionRecap({
  rpc,
  demo,
}: {
  rpc: HubRpc;
  demo: boolean;
}) {
  const [days, setDays] = useState(7);
  const [result, setResult] = useState<{
    days: number;
    data: ConsumptionSummary | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    void rpc<ConsumptionSummary>("get_consumption_summary", { p_days: days })
      .then((data) => {
        if (alive) setResult({ days, data, error: "" });
      })
      .catch((e) => {
        if (alive)
          setResult({
            days,
            data: null,
            error:
              e instanceof Error ? e.message : "Récapitulatif indisponible.",
          });
      });
    return () => {
      alive = false;
    };
  }, [rpc, days]);
  const current = result?.days === days ? result : null;
  return (
    <section
      className="consumption-recap"
      aria-label="Récapitulatif des consommations"
    >
      <h3>Mes consommations déclarées</h3>
      <label>
        Période
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 derniers jours</option>
          <option value={30}>30 derniers jours</option>
        </select>
      </label>
      <p className="fine-print">
        Récapitulatif personnel, sans objectif ni récompense.{" "}
        {demo
          ? "Données fictives de cette démo."
          : "Calculé sur tout ton historique de la période."}
      </p>
      {!current ? (
        <p role="status">Chargement…</p>
      ) : current.error ? (
        <p role="status">{current.error}</p>
      ) : current.data?.items.length ? (
        <dl>
          {current.data.items.map((item) => (
            <div key={item.catalog_id}>
              <dt>{item.label}</dt>
              <dd>
                {item.quantity} <small>{item.unit}</small>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>Aucune consommation enregistrée sur cette période.</p>
      )}
      <p className="fine-print">
        Les anciens « verres » et « vin ou bière » restent séparés : leur
        contenu n’est pas précisé. Une déclaration appartient à une seule
        catégorie.
      </p>
    </section>
  );
}
