import type { HubRpc } from "../events/types";
export type Reaction = "clap" | "strength" | "laugh";
export type Encouragement = {
  action_id: string;
  counts: Record<Reaction, number>;
  mine: Reaction | null;
  can_react: boolean;
};
export type MissionCode =
  | "pause_days"
  | "healthy_days"
  | "healthy_variety"
  | "new_habit"
  | "competition_action";
export type Mission = {
  code: MissionCode;
  target: number;
  progress: number;
  selected: boolean;
  completed: boolean;
  awarded: boolean;
  xp: number;
  available: boolean;
};
export type CosmeticSlot = "accessory" | "title" | "background";
export type EquippedLook = Record<CosmeticSlot, string | null>;
export type PublicBadge = {
  id: string;
  label: string;
  icon: "star" | "trophy" | "medal" | "leaf" | "flame";
};
export type PlayerLook = {
  user_id: string;
  level: number;
  equipped: EquippedLook;
  badges: PublicBadge[];
};
export type CosmeticDefinition = {
  id: string;
  slot: CosmeticSlot;
  label: string;
  description: string;
  xpRequired: number;
  badgeRequirement?: "any" | "winner";
};
export type ProgressionState = {
  available: true;
  week_start: string;
  week_end: string;
  xp: number;
  level: number;
  week_xp: number;
  missions: Mission[];
  inventory: { id: string; slot: CosmeticSlot; unlocked: boolean }[];
  equipped: EquippedLook;
  badges: PublicBadge[];
  notify_reactions: boolean;
};
export type MissionsProps = {
  progression: ProgressionState;
  rpc: HubRpc;
  changed: () => Promise<void>;
  demo: boolean;
};
export type WardrobeProps = MissionsProps & {
  variant: number;
  onClose: () => void;
};
export type ReactionsProps = {
  value: Encouragement;
  rpc: HubRpc;
  onChanged: (value: Encouragement) => void;
};

// RPC contracts (public wrappers over authenticated private functions):
// get_encouragements({p_action_ids: UUID[] <=50}) => Encouragement[] (unauthorized IDs omitted)
// set_action_reaction({p_action_id: UUID,p_reaction: Reaction|null}) => Encouragement
// set_reaction_preferences({p_enabled:boolean}) => void
// get_progression({}) => ProgressionState
// choose_weekly_mission({p_code: MissionCode}) => void
// equip_cosmetic({p_slot:CosmeticSlot,p_item_id:string|null}) => void
// get_player_looks({p_user_ids:UUID[] <=60}) => PlayerLook[] (unauthorized IDs omitted)
