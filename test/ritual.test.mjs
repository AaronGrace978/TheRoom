import assert from "node:assert/strict";
import test from "node:test";
import { createRitual } from "../public/js/ritual.js";
import { DEFAULT_TIMING } from "../public/js/timing.js";

test("a held stillness becomes dawn, then black", () => {
  const ritual = createRitual({ ...DEFAULT_TIMING, holdMs: 1000, dawnMs: 500, peakMs: 200, fadeMs: 500, graceMs: 300 });
  let view = ritual.update(0.2, 0.5);
  assert.equal(view.mode, "night");
  assert.equal(view.light, 0);

  view = ritual.update(0.9, 0.6);
  assert.equal(view.mode, "night");
  assert.ok(view.light > 0 && view.light < 0.22);

  view = ritual.update(0.9, 0.6);
  assert.equal(view.justDawned, true);
  assert.equal(view.mode, "dawn");
  const atDawn = view.light;

  view = ritual.update(0.1, 0.5);
  assert.equal(view.mode, "peak");
  assert.equal(view.light, 1);
  assert.ok(view.light >= atDawn);

  view = ritual.update(0, 0.25);
  assert.equal(view.mode, "fade");
  assert.ok(view.darkness > 0 && view.darkness < 1);

  view = ritual.update(0, 0.5);
  assert.equal(view.mode, "black");
  assert.equal(view.darkness, 1);
});

test("a broken rhythm lets the gathering go", () => {
  const ritual = createRitual({ ...DEFAULT_TIMING, holdMs: 5000, graceMs: 400, release: 0.6, threshold: 0.74 });
  ritual.update(0.9, 1);
  const dipped = ritual.update(0.2, 0.5);
  assert.equal(dipped.hold, 0);
});

test("an outside dawn is accepted once", () => {
  const ritual = createRitual(DEFAULT_TIMING);
  assert.equal(ritual.beginDawn(), true);
  assert.equal(ritual.beginDawn(), false);
  assert.equal(ritual.mode, "dawn");
});
