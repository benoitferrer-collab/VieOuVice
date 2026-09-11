export type CoopTemplate = "sport" | "walk" | "pause";
export type CoopChallenge = {
  id: string;
  creator_name: string;
  template: CoopTemplate;
  title: string;
  target: number;
  unit: string;
  progress: number;
  my_progress: number;
  status: "active" | "completed" | "expired";
  ends_at: string;
  member_status: "invited" | "accepted" | "declined" | "left";
  participant_count: number;
  contributor_count: number;
  badge: boolean;
};
export type CoopHub = { challenges: CoopChallenge[] };
export type ConsumptionSummary = {
  days: number;
  items: {
    catalog_id: string;
    label: string;
    unit: string;
    quantity: number;
  }[];
};
