import { useId } from "react";
import type { EquippedLook } from "@/lib/progression/types";
export function Reaper({
  variant = 0,
  large = false,
  cosmetics,
}: {
  variant?: number;
  large?: boolean;
  cosmetics?: EquippedLook;
}) {
  const id = useId();
  const color = ["#b7f34b", "#c4acff", "#ffca6a", "#ff8e99"][variant % 4];
  return (
    <svg
      className={large ? "reaper-large" : "reaper-small"}
      viewBox="0 0 240 240"
      role="img"
      aria-label={
        [
          "Avatar survivant",
          "Avatar funambule",
          "Avatar divinité",
          "Avatar zombie",
        ][variant % 4]
      }
    >
      <defs>
        <radialGradient id={id + "aurora"}>
          <stop stopColor="#b7f34b" stopOpacity=".42" />
          <stop offset=".6" stopColor="#9875e9" stopOpacity=".35" />
          <stop offset="1" stopColor="#9875e9" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id + "golden"}>
          <stop stopColor="#ffe7a4" stopOpacity=".65" />
          <stop offset=".65" stopColor="#e9ae47" stopOpacity=".28" />
          <stop offset="1" stopColor="#e9ae47" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id + "robe"} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#445047" />
          <stop offset=".5" stopColor="#28332c" />
          <stop offset="1" stopColor="#171e21" />
        </linearGradient>
        <linearGradient id={id + "face"} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#f7f5d9" />
          <stop offset="1" stopColor="#bcc8a6" />
        </linearGradient>
      </defs>
      {(cosmetics?.background === "aurora" ||
        cosmetics?.background === "golden") && (
        <circle
          cx="120"
          cy="120"
          r="118"
          fill={`url(#${id}${cosmetics.background})`}
        />
      )}
      {cosmetics?.background === "constellation" && (
        <g>
          <circle cx="120" cy="120" r="114" fill="#302652" opacity=".65" />
          <path
            d="M24 122 41 61 69 37M177 29 199 68 213 131 191 183M24 122 37 191 78 211"
            stroke="#c4acff"
            strokeWidth="1.5"
            opacity=".5"
            fill="none"
          />
          {[
            [24, 122],
            [41, 61],
            [69, 37],
            [177, 29],
            [199, 68],
            [213, 131],
            [191, 183],
            [37, 191],
            [78, 211],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" fill="#e9e0ff" />
          ))}
        </g>
      )}
      {large && (
        <>
          <ellipse cx="122" cy="218" rx="61" ry="9" fill="#000" opacity=".25" />
          <path
            d="M25 101l5-9m-7 2l10 4M199 157l8 4m-4-8v15M60 51v10m-5-5h10"
            stroke={color}
            strokeWidth="2"
            opacity=".65"
          />
          <circle cx="182" cy="39" r="2" fill={color} />
        </>
      )}
      <path
        d="M174 50l-7 163"
        stroke="#9c8562"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M167 52c32-12 47-1 58 20-20-10-33-9-54-3z"
        fill="#d5ddd2"
        stroke="#99a599"
        strokeWidth="2"
      />
      <path
        d="M78 112C62 137 55 187 62 210l18-6 14 10 20-8 18 11 15-9 17 3c0-45-9-76-24-97z"
        fill={"url(#" + id + "robe)"}
        stroke="#53604b"
        strokeWidth="2"
      />
      <path
        d="M75 135c-14 6-25 24-18 32 10 8 26-9 34-18M145 131c14-1 23 8 25 23"
        fill="none"
        stroke="#354332"
        strokeWidth="22"
        strokeLinecap="round"
      />
      <path
        d="M160 153l10-3"
        stroke="#d4dab9"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M67 99c-2-45 17-75 46-77 35-3 63 31 62 81-9 29-99 29-108-4Z"
        fill={"url(#" + id + "robe)"}
        stroke="#56624d"
        strokeWidth="2"
      />
      <path
        d="M79 88c0-33 15-48 36-48 25 0 45 22 45 50 0 36-82 44-81-2"
        fill="#101a17"
      />
      <path
        d="M89 83c-1-21 12-32 28-32 18 0 32 12 31 32l-4 19-9 5-2 14-30-1-4-14-9-5Z"
        fill={"url(#" + id + "face)"}
      />
      <ellipse cx="103" cy="84" rx="10" ry="12" fill="#202b22" />
      <ellipse cx="135" cy="83" rx="10" ry="12" fill="#202b22" />
      <circle cx="106" cy="81" r="3" fill={color} />
      <circle cx="132" cy="80" r="3" fill={color} />
      <path d="m119 93-4 8h8z" fill="#65745c" />
      <path d="M108 113v7m10-7v7m9-7v7" stroke="#65745c" strokeWidth="2" />
      <path
        d="M91 132c11 10 32 10 43 0M91 159l-6 39m40-44 7 46"
        fill="none"
        stroke="#617250"
        strokeWidth="2"
        opacity=".7"
      />
      <circle cx="111" cy="142" r="8" fill={color} />
      <path d="m111 137-3 6h4l-2 5 6-7h-4l2-4" fill="#263b1d" />
      {cosmetics?.accessory === "leaf_pin" && (
        <g>
          <path
            d="M132 157c-9-17 0-27 17-26 1 16-5 26-17 26Z"
            fill="#b7f34b"
            stroke="#e1ffa5"
            strokeWidth="2"
          />
          <path
            d="m129 162 13-23m-7 10 7-1"
            fill="none"
            stroke="#39542b"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
      {cosmetics?.accessory === "halo" && (
        <g fill="none" stroke="#f5de9b">
          <ellipse
            cx="115"
            cy="17"
            rx="38"
            ry="9"
            strokeWidth="10"
            opacity=".17"
          />
          <ellipse cx="115" cy="17" rx="38" ry="9" strokeWidth="3" />
        </g>
      )}
      {cosmetics?.accessory === "laurel" && (
        <g fill="#e6c675" stroke="#ffe6a0" strokeWidth="1">
          <path
            d="M78 70q-8-28 18-44M158 70q8-28-18-44"
            fill="none"
            strokeWidth="3"
          />
          <ellipse
            cx="77"
            cy="57"
            rx="5"
            ry="10"
            transform="rotate(-25 77 57)"
          />
          <ellipse
            cx="84"
            cy="42"
            rx="5"
            ry="10"
            transform="rotate(-35 84 42)"
          />
          <ellipse
            cx="94"
            cy="30"
            rx="5"
            ry="9"
            transform="rotate(-45 94 30)"
          />
          <ellipse
            cx="159"
            cy="57"
            rx="5"
            ry="10"
            transform="rotate(25 159 57)"
          />
          <ellipse
            cx="152"
            cy="42"
            rx="5"
            ry="10"
            transform="rotate(35 152 42)"
          />
          <ellipse
            cx="142"
            cy="30"
            rx="5"
            ry="9"
            transform="rotate(45 142 30)"
          />
        </g>
      )}
      {variant === 2 && (
        <ellipse
          cx="115"
          cy="21"
          rx="30"
          ry="8"
          fill="none"
          stroke={color}
          strokeWidth="5"
        />
      )}
    </svg>
  );
}
