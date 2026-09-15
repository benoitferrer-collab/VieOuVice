import type { HubRpc } from "../events/types";
import type { ProgressionState, Wallet } from "./types";

export class PurchaseError extends Error {
  constructor(
    message: string,
    public progression?: ProgressionState,
  ) {
    super(message);
    this.name = "PurchaseError";
  }
}

/** A lost purchase response must be reconciled against the owned inventory. */
export async function purchaseCosmetic(
  rpc: HubRpc,
  itemId: string,
): Promise<{
  wallet: Wallet;
  progression?: ProgressionState;
}> {
  try {
    const wallet = await rpc<Wallet>("buy_cosmetic", { p_item_id: itemId });
    return { wallet };
  } catch (failure) {
    let refreshed: ProgressionState | undefined;
    try {
      const progression = await rpc<ProgressionState>("get_progression");
      refreshed = progression;
      if (
        progression.wallet &&
        progression.inventory.some((i) => i.id === itemId && i.unlocked)
      )
        return { wallet: progression.wallet, progression };
    } catch {
      /* Keep the original purchase error when reconciliation is unavailable. */
    }
    throw new PurchaseError(
      failure instanceof Error ? failure.message : "Achat non confirmé.",
      refreshed,
    );
  }
}
