import { recipeSchema } from "@/lib/emojis/recipes";
export function ComposedEmoji({
  recipe,
  label,
  size = 72,
}: {
  recipe: unknown;
  label: string;
  size?: number;
}) {
  const result = recipeSchema.safeParse(recipe);
  if (!result.success) return <span>{label}</span>;
  const r = result.data;
  const colors = {
    gold: "#f8c84e",
    rose: "#f7a8bd",
    mint: "#7ddbb2",
    sky: "#85c9ff",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
    >
      {r.face === "cat" && (
        <path
          d="M17 40 L15 12 L39 29 M61 29 L85 12 L83 40"
          fill={colors[r.color]}
          stroke="#403342"
          strokeWidth="3"
        />
      )}
      {r.face === "bear" && (
        <g fill={colors[r.color]} stroke="#403342" strokeWidth="3">
          <circle cx="23" cy="25" r="13" />
          <circle cx="77" cy="25" r="13" />
        </g>
      )}
      <circle
        cx="50"
        cy="53"
        r="35"
        fill={colors[r.color]}
        stroke="#403342"
        strokeWidth="3"
      />
      <g fill="#403342" stroke="#403342" strokeWidth="3" strokeLinecap="round">
        {r.expression === "love" ? (
          <>
            <path
              d="M29 44 Q23 35 29 35 Q34 33 35 39 Q42 30 43 38 Q44 42 35 49Z"
              fill="#d73563"
              stroke="none"
            />
            <path
              d="M58 44 Q52 35 58 35 Q63 33 64 39 Q71 30 72 38 Q73 42 64 49Z"
              fill="#d73563"
              stroke="none"
            />
          </>
        ) : (
          <>
            <circle cx="35" cy="44" r="3" />
            {r.expression === "wink" ? (
              <path d="M61 44h10" />
            ) : (
              <circle cx="65" cy="44" r="3" />
            )}
          </>
        )}
        {r.expression === "laugh" ? (
          <path d="M34 60 Q50 85 66 60Z" />
        ) : (
          <path d="M35 61 Q50 77 65 61" fill="none" />
        )}
      </g>
      {r.accessory === "crown" && (
        <path
          d="M30 24L25 9L41 16L50 3L59 16L75 9L70 24Z"
          fill="#ffdf64"
          stroke="#403342"
          strokeWidth="2"
        />
      )}
      {r.accessory === "party" && (
        <path
          d="M34 24L53 2L66 25Z"
          fill="#b596ef"
          stroke="#403342"
          strokeWidth="2"
        />
      )}
      {r.accessory === "star" && (
        <path
          d="M82 5L86 15L97 16L89 23L92 34L82 28L72 34L75 23L67 16L78 15Z"
          fill="#ffdf64"
          stroke="#403342"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
