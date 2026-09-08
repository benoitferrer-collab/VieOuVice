export function recoveredImpact(
  action: { catalog_id: string; quantity: number; minutes_impact: number },
  catalogId: string,
  quantity: number,
): number {
  if (action.catalog_id !== catalogId || action.quantity !== quantity)
    throw new Error(
      "Cette clé correspond à une déclaration au contenu différent.",
    );
  return action.minutes_impact;
}
