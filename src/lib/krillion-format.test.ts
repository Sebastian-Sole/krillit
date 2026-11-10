import { test } from "node:test";
import assert from "node:assert/strict";
import { dateFor, dayNumberFor, distAverage, parseShareText, percentileFor, weekdayIndex } from "./krillion-format.ts";

test("parses the share text Krillion copies", () => {
  const r = parseShareText("Krillion #118 🦐 345  🫧🐟🦑⬛🏮🌟🤡  https://krillion.io");
  assert.deepEqual(r, { dayNumber: 118, score: 345, slots: ["plankton", "schooler", "rare", "miss", "deepcut", "krillion", "tooclever"] });
});

test("parses the multi-line text from Krillion's share sheet", () => {
  const r = parseShareText("Krillion #118 🦐\n310\n\n🦑🐟🦑🐟🦑🫧🦑");
  assert.deepEqual(r, { dayNumber: 118, score: 310, slots: ["rare", "schooler", "rare", "schooler", "rare", "plankton", "rare"] });
});

test("parses the multi-line text with Windows line endings and a link", () => {
  const r = parseShareText("Krillion #118 🦐\r\n310\r\n\r\n🦑🐟🦑🐟🦑🫧🦑\r\nhttps://krillion.io");
  assert.ok(!("error" in r) && r.score === 310);
});

test("tolerates chat noise and emoji variation selectors", () => {
  const r = parseShareText("Ana: look at this\nKrillion #117 🦐 200 ⬛️🫧 🫧🐟🐟🦑🦑\nwow");
  assert.ok(!("error" in r));
  assert.equal(r.slots[0], "miss");
});

test("rejects archive and unlimited dives", () => {
  assert.ok("error" in parseShareText("Krillion ⟲ #100 🦐 300  🫧🐟🦑⬛🏮🌟🤡"));
  assert.ok("error" in parseShareText("Krillion ∞ #5 🦐 300  🫧🐟🦑⬛🏮🌟🤡"));
  assert.ok("error" in parseShareText("Krillion ⟲ #100 🦐\n300\n\n🫧🐟🦑⬛🏮🌟🤡"));
});

test("rejects junk and short results", () => {
  assert.ok("error" in parseShareText("hello"));
  assert.ok("error" in parseShareText("Krillion #118 🦐 345  🫧🐟"));
});

test("day numbers line up with Krillion's calendar", () => {
  assert.equal(dayNumberFor("2026-11-10"), 118);
  assert.equal(dateFor(118), "2026-11-10");
  assert.equal(dateFor(1), "2026-07-16");
  assert.equal(weekdayIndex("2026-11-10"), 1); // Tuesday
});

test("average and percentile from the histogram", () => {
  const dist = [884, 3416, 14006, 25549, 60945, 83668, 121284, 148934, 152775, 112080, 101896, 74761, 31553, 17080, 11945, 3142, 2059, 1126, 343, 59];
  assert.equal(Math.round(distAverage(dist)!), 288);
  // Krillion's own API said a 300 beats 55% of players that day.
  assert.ok(Math.abs(percentileFor(300, dist)! - 55) < 2.5);
});
