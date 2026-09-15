import { useId } from "react";
import "./shop-avatar.css";

type ShopAvatarProps = {
  id: string | null | undefined;
  large: boolean;
};

const motionClass = (base: string, large: boolean) =>
  large ? `${base} shop-avatar--animated` : base;

export function ShopAvatarBackground({ id, large }: ShopAvatarProps) {
  const paintId = useId();

  if (id === "astral_mist") {
    return (
      <g data-cosmetic={id} aria-hidden="true">
        <defs>
          <radialGradient id={`${paintId}mist-gradient`} cx="50%" cy="54%">
            <stop offset="0" stopColor="#a77cf4" stopOpacity=".5" />
            <stop offset=".55" stopColor="#7650ba" stopOpacity=".28" />
            <stop offset="1" stopColor="#392853" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle
          cx="120"
          cy="124"
          r="112"
          fill={`url(#${paintId}mist-gradient)`}
        />
        <path
          d="M20 166c23-19 43-13 58-4 16-19 44-17 57 0 24-17 57-8 77 12-23 23-61 26-92 14-31 13-72 5-100-22Z"
          fill="#b99ae9"
          opacity=".2"
        />
        <path
          d="M33 193c25-15 49-11 65-1 22-13 54-10 76 4 14-8 29-7 40 0-47 30-137 29-181-3Z"
          fill="#674698"
          opacity=".26"
        />
      </g>
    );
  }

  if (id === "firefly_garden") {
    return (
      <g data-cosmetic={id} aria-hidden="true">
        <defs>
          <radialGradient id={`${paintId}garden-glow`}>
            <stop stopColor="#efffa4" stopOpacity=".95" />
            <stop offset="1" stopColor="#b7f34b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="120" cy="127" r="111" fill="#17372f" opacity=".5" />
        <path
          d="M15 193c18-25 33-35 55-41-9 18-7 35 3 53M225 190c-19-25-37-34-58-38 10 18 8 35-3 54"
          fill="none"
          stroke="#6f9f5e"
          strokeWidth="7"
          strokeLinecap="round"
          opacity=".72"
        />
        <g className={motionClass("shop-avatar__fireflies", large)}>
          {[
            [42, 92, 5],
            [61, 55, 4],
            [189, 72, 5],
            [207, 134, 4],
            [37, 150, 3],
          ].map(([cx, cy, r]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={r}
              fill={`url(#${paintId}garden-glow)`}
            />
          ))}
        </g>
      </g>
    );
  }

  if (id === "cosmic_portal") {
    return (
      <g data-cosmetic={id} aria-hidden="true">
        <defs>
          <linearGradient
            id={`${paintId}portal-gradient`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop stopColor="#7be7ff" />
            <stop offset=".48" stopColor="#c4acff" />
            <stop offset="1" stopColor="#ff8ec7" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="120" r="112" fill="#211b43" opacity=".62" />
        <g className={motionClass("shop-avatar__portal", large)}>
          <circle
            cx="120"
            cy="120"
            r="99"
            fill="none"
            stroke={`url(#${paintId}portal-gradient)`}
            strokeWidth="9"
            strokeDasharray="54 13 21 9"
            opacity=".85"
          />
          <circle
            cx="120"
            cy="120"
            r="86"
            fill="none"
            stroke="#9ccfff"
            strokeWidth="2"
            strokeDasharray="8 11"
            opacity=".55"
          />
        </g>
      </g>
    );
  }

  return null;
}

export function ShopAvatarAccessory({ id, large }: ShopAvatarProps) {
  const paintId = useId();

  if (id === "friendly_star") {
    return (
      <g data-cosmetic={id} aria-hidden="true">
        <defs>
          <radialGradient id={`${paintId}star-gradient`}>
            <stop stopColor="#fff8be" />
            <stop offset="1" stopColor="#ffc84d" />
          </radialGradient>
        </defs>
        <circle
          cx="137"
          cy="151"
          r="14"
          fill="#422f58"
          stroke="#f6d979"
          strokeWidth="2"
        />
        <path
          d="m137 140 3.3 7 7.7 1.1-5.6 5.3 1.4 7.6-6.8-3.7-6.8 3.7 1.4-7.6-5.6-5.3 7.7-1.1Z"
          fill={`url(#${paintId}star-gradient)`}
          stroke="#fff3b0"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </g>
    );
  }

  if (id === "lunar_crown") {
    return (
      <g data-cosmetic={id} aria-hidden="true">
        <defs>
          <linearGradient
            id={`${paintId}moon-gradient`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop stopColor="#f8fbff" />
            <stop offset="1" stopColor="#9eb2d8" />
          </linearGradient>
        </defs>
        <path
          d="M84 37c13-18 40-25 63-10l-11 11-16-13-13 15-17-8Z"
          fill={`url(#${paintId}moon-gradient)`}
          stroke="#eff5ff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M116 10c11 1 18 10 17 20-2 11-12 18-23 15 8-2 13-8 14-16 1-7-2-14-8-19Z"
          fill="#dbe7ff"
          stroke="#ffffff"
          strokeWidth="1.5"
        />
        <circle cx="88" cy="29" r="3" fill="#fff3aa" />
        <circle cx="148" cy="24" r="3" fill="#fff3aa" />
      </g>
    );
  }

  if (id === "light_satellites") {
    return (
      <g
        className={motionClass("shop-avatar__satellites", large)}
        data-cosmetic={id}
        aria-hidden="true"
      >
        <ellipse
          cx="120"
          cy="124"
          rx="92"
          ry="53"
          fill="none"
          stroke="#bdeeff"
          strokeWidth="1.5"
          strokeDasharray="5 8"
          opacity=".5"
        />
        <g fill="#edffff" stroke="#7adcf5" strokeWidth="3">
          <circle cx="29" cy="119" r="6" />
          <circle cx="178" cy="82" r="7" />
          <circle cx="175" cy="166" r="5" />
        </g>
      </g>
    );
  }

  return null;
}
