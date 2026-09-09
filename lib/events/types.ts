import type { CatalogItem } from "@/lib/game";
export type CompetitionMetric =
  "health_minutes" | "net_minutes" | "category_minutes";
export type BadgeIcon = "trophy" | "medal" | "leaf" | "flame";
export type CompetitionStatus =
  "draft" | "published" | "cancelled" | "completed";
export type CompetitionDraft = {
  id: string | null;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  metric: CompetitionMetric;
  catalog_id: string | null;
  badge_label: string;
  badge_icon: BadgeIcon;
};
export type CompetitionSummary = CompetitionDraft & {
  id: string;
  status: CompetitionStatus;
  joined: boolean;
  participant_count: number;
  my_score: number | null;
  my_rank: number | null;
};
export type CompetitionStanding = {
  user_id: string;
  nickname: string;
  avatar: number;
  score: number;
  rank: number;
  action_count: number;
};
export type CompetitionDetail = CompetitionSummary & {
  leaderboard: CompetitionStanding[];
  next_offset: number | null;
};
export type CompetitionBadge = {
  event_id: string;
  event_title: string;
  label: string;
  icon: BadgeIcon;
  kind: "winner" | "podium" | "participant";
  rank: number;
  awarded_at: string;
};
export type SocialHub = {
  available: true;
  is_admin: boolean;
  share_history: boolean;
  events: CompetitionSummary[];
  badges: CompetitionBadge[];
};
export type SharedAction = {
  id: string;
  label: string;
  kind: "health" | "excess";
  quantity: number;
  minutes_impact: number;
  created_at: string;
};
export type FriendActivityPage = {
  friend: { id: string; nickname: string; avatar: number };
  shared: boolean;
  actions: SharedAction[];
  next_cursor: { created_at: string; id: string } | null;
};
export type AdminUser = {
  id: string;
  nickname: string;
  email: string;
  avatar: number;
  is_admin: boolean;
  suspended: boolean;
  created_at: string;
};
export type AdminAudit = {
  id: string;
  actor_id: string;
  action: string;
  target_id: string;
  reason: string;
  created_at: string;
};
export type AdminDashboard = {
  users: AdminUser[];
  next_offset: number | null;
  events: CompetitionSummary[];
  catalog: (CatalogItem & { active: boolean })[];
  audit: AdminAudit[];
};
export type HubRpc = <T = unknown>(
  name: string,
  payload?: Record<string, unknown>,
) => Promise<T>;
export type CompetitionsProps = {
  events: CompetitionSummary[];
  demo: boolean;
  rpc: HubRpc;
  changed: () => Promise<void>;
  appearanceRpc?: HubRpc;
};
export type AdminPanelProps = {
  userId: string;
  rpc: HubRpc;
  changed: () => Promise<void>;
  onClose: () => void;
};
