import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultPreferences,
  quietAt,
  parsePreferences,
} from "../lib/notification-preferences/rules";
test("overnight hours include start and exclude end in the selected zone", () => {
  const p = {
    ...defaultPreferences,
    quiet_enabled: true,
    quiet_start: "22:00",
    quiet_end: "07:00",
    timezone: "Europe/Paris",
  };
  assert.equal(quietAt(p, new Date("2026-01-01T21:00:00Z")), true);
  assert.equal(quietAt(p, new Date("2026-01-02T05:59:00Z")), true);
  assert.equal(quietAt(p, new Date("2026-01-02T06:00:00Z")), false);
});
test("quiet hours follow DST wall time including repeated hour", () => {
  const p = {
    ...defaultPreferences,
    quiet_enabled: true,
    quiet_start: "02:00",
    quiet_end: "03:00",
    timezone: "Europe/Paris",
  };
  assert.equal(quietAt(p, new Date("2026-10-25T00:30:00Z")), true);
  assert.equal(quietAt(p, new Date("2026-10-25T01:30:00Z")), true);
  assert.equal(quietAt(p, new Date("2026-03-29T01:30:00Z")), false);
});
test("preferences reject invalid zones, clocks, equal quiet boundaries and nonboolean categories", () => {
  assert.throws(() =>
    parsePreferences({ ...defaultPreferences, timezone: "bad/zone" }),
  );
  assert.throws(() =>
    parsePreferences({ ...defaultPreferences, quiet_start: "24:00" }),
  );
  assert.throws(() =>
    parsePreferences({
      ...defaultPreferences,
      quiet_enabled: true,
      quiet_start: "07:00",
      quiet_end: "07:00",
    }),
  );
  assert.throws(() =>
    parsePreferences({ ...defaultPreferences, messages: "yes" }),
  );
  assert.equal(
    parsePreferences({ ...defaultPreferences, messages: false }).friends,
    true,
  );
  assert.equal(defaultPreferences.reminders, false);
});
