import assert from "node:assert/strict";
import test from "node:test";
import { createBreath } from "../public/js/breath.js";

test("the flame rests, rises with a hold, and learns the cycle", () => {
  const breath = createBreath();
  breath.tick(1, 1000);
  assert.ok(breath.sample().fullness > 0.14 && breath.sample().fullness < 0.2);

  breath.down(1000);
  breath.tick(3, 4000);
  assert.ok(breath.sample().fullness > 0.85, breath.sample().fullness);

  breath.up(4000);
  breath.tick(3, 7000);
  assert.ok(breath.sample().fullness < 0.4, breath.sample().fullness);

  breath.down(9000);
  assert.equal(breath.sample().cycles, 1);
  assert.equal(breath.sample().period, 8000);

  breath.up(12000);
  breath.down(17000);
  assert.equal(breath.sample().cycles, 2);

  breath.reset();
  assert.equal(breath.sample().cycles, 0);
  assert.equal(breath.sample().fullness, 0);
});

test("a tap is not yet a rhythm", () => {
  const breath = createBreath();
  breath.down(0);
  breath.up(200);
  breath.down(800);
  assert.equal(breath.sample().cycles, 0);
});
