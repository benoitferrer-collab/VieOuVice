import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const nodeRequire = createRequire(import.meta.url);
nodeRequire.extensions[".css"] = () => undefined;
const { Reaper } = nodeRequire(
  "../components/avatar",
) as typeof import("../components/avatar");

const emptyLook = {
  accessory: null,
  title: null,
  background: null,
};
test("illustrated characters keep equipment in victory and defeated poses", () => {
  const win = renderToStaticMarkup(
    createElement(Reaper, {
      large: true,
      celebration: 1,
      cosmetics: { ...emptyLook, accessory: "friendly_star" },
    }),
  );
  assert.match(win, /data-expression="victory"/);
  assert.match(win, /avatar-celebrating/);
  assert.match(win, /data-cosmetic="friendly_star"/);
  const lost = renderToStaticMarkup(
    createElement(Reaper, { large: true, defeated: true, variant: 3 }),
  );
  assert.match(lost, /data-expression="tired"/);
  const ids = new Set([...win.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  for (const match of win.matchAll(/url\(#([^\)]+)\)/g))
    assert.ok(ids.has(match[1]), `missing gradient ${match[1]}`);
});

function renderCosmetic(
  slot: "accessory" | "background",
  id: string,
  large = true,
) {
  return renderToStaticMarkup(
    createElement(Reaper, {
      large,
      cosmetics: { ...emptyLook, [slot]: id },
    }),
  );
}

test("shop accessories render distinct SVG decorations without replacing the avatar", () => {
  const ids = ["friendly_star", "lunar_crown", "light_satellites"];
  const renders = ids.map((id) => renderCosmetic("accessory", id));

  for (const [index, html] of renders.entries()) {
    assert.match(html, new RegExp(`data-cosmetic="${ids[index]}"`));
    assert.match(html, /data-character="0"/);
    assert.doesNotMatch(html, /<script|javascript:/i);
  }

  assert.equal(new Set(renders).size, ids.length);
});

test("shop backgrounds render distinct SVG scenery behind the avatar", () => {
  const ids = ["astral_mist", "firefly_garden", "cosmic_portal"];
  const renders = ids.map((id) => renderCosmetic("background", id));

  for (const [index, html] of renders.entries()) {
    const cosmeticAt = html.indexOf(`data-cosmetic="${ids[index]}"`);
    const avatarAt = html.indexOf('d="M174 50l-7 163"');
    assert.ok(cosmeticAt >= 0 && cosmeticAt < avatarAt);
    assert.doesNotMatch(html, /<script|javascript:/i);
  }

  assert.equal(new Set(renders).size, ids.length);
});

test("animated cosmetics move only on large avatars", () => {
  const large = renderCosmetic("accessory", "light_satellites", true);
  const thumbnail = renderCosmetic("accessory", "light_satellites", false);

  assert.match(large, /shop-avatar--animated/);
  assert.match(large, /shop-avatar--floating/);
  assert.doesNotMatch(thumbnail, /shop-avatar--animated|shop-avatar--floating/);
  assert.match(thumbnail, /data-cosmetic="light_satellites"/);
});

test("paint servers stay unique while historical cosmetics remain available", () => {
  const paired = renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(Reaper, {
        cosmetics: { ...emptyLook, accessory: "leaf_pin" },
      }),
      createElement(Reaper, {
        cosmetics: { ...emptyLook, background: "cosmic_portal" },
      }),
      createElement(Reaper, {
        cosmetics: { ...emptyLook, background: "cosmic_portal" },
      }),
    ),
  );

  assert.match(paired, /d="M132 157c-9-17 0-27 17-26/);
  const portalGradientIds = [
    ...paired.matchAll(/id="([^"]*portal-gradient)"/g),
  ].map((match) => match[1]);
  assert.equal(portalGradientIds.length, 2);
  assert.equal(new Set(portalGradientIds).size, 2);
  for (const id of portalGradientIds) {
    assert.match(paired, new RegExp(`url\\(#${id}\\)`));
  }
});

test("large avatars expose keyboard interaction and four distinct personalities", () => {
  for (let variant = 0; variant < 4; variant++) {
    const html = renderToStaticMarkup(
      createElement(Reaper, { variant, large: true }),
    );
    assert.match(html, /role="button"/);
    assert.match(html, /tabindex="0"/);
    assert.match(html, new RegExp(`avatar-personality-${variant}`));
  }
  const small = renderToStaticMarkup(createElement(Reaper, { large: false }));
  assert.doesNotMatch(small, /role="button"|tabindex/);
});
