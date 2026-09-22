"use client";

import "./avatar-motion.css";
import { CharacterBody } from "./character-body";
import { useId, useState } from "react";
import type { EquippedLook } from "@/lib/progression/types";
import {
  ShopAvatarAccessory,
  ShopAvatarBackground,
} from "@/components/progression/shop-avatar";
export function Reaper({
  variant = 0,
  large = false,
  cosmetics,
  celebration = 0,
  defeated = false,
}: {
  variant?: number;
  large?: boolean;
  cosmetics?: EquippedLook;
  celebration?: number;
  defeated?: boolean;
}) {
  const id = useId();
  const [reaction, setReaction] = useState(0);
  const personality = ((Math.trunc(variant) % 4) + 4) % 4;
  const react = () => setReaction((value) => value + 1);
  const color = ["#b7f34b", "#c4acff", "#ffca6a", "#ff8e99"][personality];
  return (
    <svg
      className={large ? "reaper-large shop-avatar--floating" : "reaper-small"}
      viewBox="0 0 240 240"
      role={large ? "button" : "img"}
      tabIndex={large ? 0 : undefined}
      onClick={large ? react : undefined}
      onKeyDown={
        large
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (!event.repeat) react();
              }
            }
          : undefined
      }
      aria-label={
        [
          "Avatar survivant",
          "Avatar funambule",
          "Avatar divinité",
          "Avatar zombie",
        ][personality] + (large ? " · Toucher pour animer" : "")
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
      <ShopAvatarBackground id={cosmetics?.background} large={large} />
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
      <g
        key={celebration}
        className={
          large && celebration > 0
            ? "avatar-reaction avatar-celebrating"
            : undefined
        }
      >
        <g
          key={reaction}
          className={
            large
              ? `avatar-reaction ${reaction ? `avatar-react-${reaction % 3}` : ""}`
              : undefined
          }
        >
          <g
            className={
              large
                ? `avatar-body avatar-personality-${personality}`
                : undefined
            }
          >
            <CharacterBody
              id={id}
              personality={personality}
              large={large}
              joyful={celebration > 0}
              defeated={defeated}
              reaction={reaction}
            />
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
            <ShopAvatarAccessory id={cosmetics?.accessory} large={large} />
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
          </g>
        </g>
        {large && celebration > 0 && (
          <g
            className="avatar-sparks"
            stroke={color}
            strokeWidth="3"
            fill="none"
            aria-hidden="true"
          >
            <path d="M30 48v12m-6-6h12M204 104v12m-6-6h12M42 178v12m-6-6h12M184 24v12m-6-6h12" />
          </g>
        )}
      </g>
    </svg>
  );
}
