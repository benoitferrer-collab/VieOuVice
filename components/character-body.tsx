/** Original layered illustration. Shared anchor points keep every owned cosmetic compatible. */
export function CharacterBody({
  id,
  personality,
  large,
  joyful,
  defeated,
  reaction,
}: {
  id: string;
  personality: number;
  large: boolean;
  joyful: boolean;
  defeated: boolean;
  reaction: number;
}) {
  const palettes = [
    { light: "#c1a0ff", mid: "#7254bd", dark: "#302551", eye: "#caff8a" },
    { light: "#ffb0d1", mid: "#ae4e85", dark: "#482742", eye: "#ffcfed" },
    { light: "#fff0b0", mid: "#bc9560", dark: "#4a3a46", eye: "#ffdf82" },
    { light: "#8fe5de", mid: "#467f99", dark: "#213b57", eye: "#9ef5d5" },
  ];
  const p = palettes[personality];
  const expression = defeated
    ? "tired"
    : joyful
      ? "victory"
      : reaction % 3 === 2
        ? "delighted"
        : personality === 1
          ? "mischief"
          : "curious";
  return (
    <g data-character={personality} data-expression={expression}>
      <defs>
        <linearGradient id={`${id}cloak`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={p.light} />
          <stop offset=".32" stopColor={p.mid} />
          <stop offset="1" stopColor={p.dark} />
        </linearGradient>
        <linearGradient id={`${id}hood`} x1=".1" y1="0" x2=".85" y2="1">
          <stop stopColor={p.light} />
          <stop offset=".26" stopColor={p.mid} />
          <stop offset=".72" stopColor={p.dark} />
          <stop offset="1" stopColor="#14152d" />
        </linearGradient>
        <radialGradient id={`${id}void`} cx=".5" cy=".3" r=".8">
          <stop stopColor="#262640" />
          <stop offset=".7" stopColor="#0d1021" />
          <stop offset="1" stopColor="#030815" />
        </radialGradient>
        <linearGradient id={`${id}blade`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff" />
          <stop offset=".42" stopColor="#ced9ec" />
          <stop offset="1" stopColor="#687799" />
        </linearGradient>
      </defs>
      <g className="avatar-scythe">
        <path
          d="M174 50l-7 163"
          stroke="#222234"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M174 50l-7 163"
          stroke="#9582aa"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M168 54C192 32 220 49 232 79c-23-18-38-14-61-7Z"
          fill={`url(#${id}blade)`}
          stroke="#e4e3fa"
          strokeWidth="1.5"
        />
        <path
          d="M177 55q25-9 43 10"
          fill="none"
          stroke="#fff"
          opacity=".7"
          strokeWidth="2"
        />
        <path
          d="m167 174 6 1m-6 6 5 1m-6 6 6 1"
          stroke={p.light}
          strokeWidth="3"
        />
      </g>
      <ellipse cx="95" cy="211" rx="20" ry="9" fill="#111729" />
      <ellipse cx="140" cy="211" rx="20" ry="9" fill="#111729" />
      <path
        d="M79 113Q54 154 61 207l21-5 15 11 18-8 20 10 12-10 18 1q-1-64-23-92Z"
        fill={`url(#${id}cloak)`}
        stroke={p.light}
        strokeOpacity=".5"
        strokeWidth="1.5"
      />
      <path
        d="M84 128q-11 45-11 66m29-58-4 66m29-67 11 68m7-74 10 64"
        fill="none"
        stroke={p.light}
        strokeOpacity=".26"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M111 129q-9 47 2 73l-16 10 18-7 20 10q-16-48-9-83Z"
        fill="#12122d"
        opacity=".25"
      />
      <g transform={joyful ? "rotate(48 79 137)" : undefined}>
        <path
          d="M80 130q-21 10-25 29 7 17 20 5l17-18"
          fill={`url(#${id}cloak)`}
          stroke={p.mid}
          strokeWidth="2"
        />
        <ellipse cx="61" cy="160" rx="10" ry="8" fill={p.light} />
        <path
          d="m59 157 3 5m2-7 3 5"
          stroke={p.dark}
          strokeWidth="1.5"
          opacity=".6"
        />
      </g>
      <path
        d="M145 127q18 0 26 25-3 10-13 9l-21-17"
        fill={`url(#${id}cloak)`}
        stroke={p.mid}
        strokeWidth="2"
      />
      <ellipse cx="168" cy="154" rx="9" ry="8" fill={p.light} />
      <g transform={defeated ? "rotate(8 118 100)" : undefined}>
        <path
          d={
            personality === 1
              ? "M60 93Q58 42 99 27L157 10 148 37q34 23 29 64-25 45-101 21Z"
              : personality === 3
                ? "M61 94Q56 45 88 29l19-9 10 8 19-5q39 21 42 76-19 42-60 38-48 0-57-43Z"
                : "M59 94Q62 30 112 19q55 2 66 76-2 41-60 44-49-2-59-45Z"
          }
          fill={`url(#${id}hood)`}
          stroke={p.light}
          strokeWidth="2"
          strokeOpacity=".65"
        />
        <path
          d="M69 88q7-46 43-57 33 6 49 50"
          fill="none"
          stroke={p.light}
          strokeOpacity=".35"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M75 89q4-42 39-48 36 3 47 44 5 34-42 39-45 0-44-35Z"
          fill={`url(#${id}void)`}
          stroke={p.mid}
          strokeWidth="3"
        />
        <g className={large ? "avatar-eyes" : undefined}>
          {defeated ? (
            <g stroke={p.eye} strokeWidth="4" strokeLinecap="round">
              <path d="m93 85 15 4m21-1 15-4" />
            </g>
          ) : joyful || expression === "delighted" ? (
            <g stroke={p.eye} strokeWidth="6" fill="none" strokeLinecap="round">
              <path d="M94 88q8-13 15 0m19 0q8-13 15 0" />
            </g>
          ) : (
            <>
              <ellipse
                cx="102"
                cy="83"
                rx="12"
                ry="16"
                fill={p.eye}
                opacity=".13"
              />
              <ellipse
                cx="137"
                cy="83"
                rx="12"
                ry="16"
                fill={p.eye}
                opacity=".13"
              />
              <g className={large ? "avatar-gaze" : undefined}>
                <ellipse
                  cx="102"
                  cy="84"
                  rx="7"
                  ry={personality === 1 ? 9 : 12}
                  fill={p.eye}
                />
                <ellipse cx="137" cy="83" rx="7" ry="12" fill={p.eye} />
                <ellipse cx="104" cy="79" rx="2.5" ry="3.5" fill="#fff" />
                <ellipse cx="139" cy="78" rx="2.5" ry="3.5" fill="#fff" />
              </g>
            </>
          )}
        </g>
        <path
          d={defeated ? "M113 105q6-5 12 0" : "M113 102q6 7 12 0"}
          fill="none"
          stroke={p.eye}
          strokeWidth="2"
          strokeLinecap="round"
          opacity=".8"
        />
        <ellipse cx="91" cy="102" rx="5" ry="2.5" fill={p.mid} opacity=".65" />
        <ellipse cx="148" cy="101" rx="5" ry="2.5" fill={p.mid} opacity=".65" />
        {personality === 3 && (
          <path
            d="m73 62 8 5m-9 2 6-12"
            stroke={p.light}
            strokeWidth="2"
            opacity=".7"
          />
        )}
      </g>
      <path
        d="M86 128q28 21 57 0l-7 16q-18 12-40-1Z"
        fill={p.dark}
        stroke={p.light}
        strokeOpacity=".45"
      />
      <circle cx="115" cy="141" r="8" fill={p.light} />
      <path d="m115 136-4 6 5 0-2 5 6-8h-5l2-3" fill={p.dark} />
    </g>
  );
}
