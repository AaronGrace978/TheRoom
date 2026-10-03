import assert from "node:assert/strict";
import test from "node:test";
import { coherence } from "../public/js/coherence.js";

function soul(period, phase, cycles = 3) {
  return { period, phase, cycles, fresh: true, fullness: 0.5 };
}

test("one candle is not yet a group", () => {
  assert.equal(coherence([soul(10000, 0.1)]).score, 0);
});

test("the same slow breath scores high", () => {
  const reading = coherence([soul(10000, 0.1), soul(10400, 0.16), soul(9800, 0.12)]);
  assert.ok(reading.score > 0.85, reading.score);
});

test("a shared pant does not open the room", () => {
  const reading = coherence([soul(4000, 0.2), soul(4200, 0.24)]);
  assert.ok(reading.score < 0.6, reading.score);
});

test("different tempos do not pass for agreement", () => {
  const reading = coherence([soul(8000, 0.1), soul(14000, 0.15)]);
  assert.ok(reading.agreement < 0.4, reading.agreement);
  assert.ok(reading.score < 0.74, reading.score);
});

test("a stale candle is left out of the count", () => {
  const reading = coherence([soul(10000, 0.2), { ...soul(10000, 0.2), fresh: false }]);
  assert.equal(reading.count, 1);
  assert.equal(reading.score, 0);
});
