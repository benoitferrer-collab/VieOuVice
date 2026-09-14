import { Star, Flame, Leaf, Moon, Crown } from "lucide-react";
import { emblemSchema } from "@/lib/ai/season-identity";
const icons = {
  star: Star,
  flame: Flame,
  leaf: Leaf,
  moon: Moon,
  crown: Crown,
};
const colors = {
  gold: "#ffcc75",
  mint: "#a2e8bf",
  violet: "#b9a0f9",
  coral: "#ff8f99",
  sky: "#8ccdf5",
};
export function SeasonEmblem({
  emblem,
  label,
  size = 90,
}: {
  emblem: unknown;
  label: string;
  size?: number;
}) {
  const parsed = emblemSchema.safeParse(emblem);
  if (!parsed.success) return null;
  const e = parsed.data,
    Icon = icons[e.icon];
  return (
    <span
      className="season-emblem"
      style={{ width: size, height: size, color: colors[e.color] }}
      role="img"
      aria-label={label}
    >
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        fill="currentColor"
        fillOpacity=".1"
        stroke="currentColor"
        strokeWidth="2"
      >
        {e.shape === "shield" ? (
          <path d="M50 5 87 19V48Q87 77 50 95 13 77 13 48V19Z" />
        ) : e.shape === "circle" ? (
          <circle cx="50" cy="50" r="43" />
        ) : (
          <path d="M50 5 89 28V72L50 95 11 72V28Z" />
        )}
      </svg>
      <Icon size={size * 0.4} strokeWidth={1.7} aria-hidden="true" />
    </span>
  );
}
