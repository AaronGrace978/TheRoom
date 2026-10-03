// The glass is the breath. Holding raises the flame at a human pace;
// letting go lets it fall, a little more slowly, the way an exhale does.
// Nothing about the breath is written down beyond this living object.

const EMBER = 0.15;
const INHALE_PER_SECOND = 0.3;
const EXHALE_PER_SECOND = 0.22;
const MIN_CYCLE_MS = 2500;
const MAX_CYCLE_MS = 20000;

function approach(current, dest, rate, dt) {
  const maxStep = rate * dt;
  const delta = dest - current;
  if (Math.abs(delta) <= maxStep) return dest;
  return current + Math.sign(delta) * maxStep;
}

export function createBreath() {
  let fullness = 0;
  let holding = false;
  let pointers = 0;
  let cycleStart = 0;
  let period = 0;
  let cycles = 0;
  let phase = 0;
  let alive = false;

  function down(now) {
    pointers += 1;
    if (holding) return;
    holding = true;
    alive = true;
    if (cycleStart) {
      const span = now - cycleStart;
      if (span >= MIN_CYCLE_MS && span <= MAX_CYCLE_MS) {
        period = span;
        cycles += 1;
      }
    }
    cycleStart = now;
  }

  function up(now) {
    pointers = Math.max(0, pointers - 1);
    if (pointers > 0) return;
    holding = false;
    void now;
  }

  function tick(dt, now) {
    const step = Math.max(0, dt);
    const dest = holding ? 1 : EMBER;
    const rate = holding ? INHALE_PER_SECOND : alive ? EXHALE_PER_SECOND : 0.22;
    fullness = approach(fullness, dest, rate, step);
    if (period > 0 && cycleStart) {
      const unit = (now - cycleStart) / period;
      phase = unit < 1 ? unit : 0.999;
    } else if (holding && cycleStart) {
      phase = Math.min(0.49, (now - cycleStart) / 8000);
    }
  }

  function sample() {
    return {
      fullness,
      phase,
      period,
      cycles,
      fresh: true,
      holding,
    };
  }

  function reset() {
    fullness = 0;
    holding = false;
    pointers = 0;
    cycleStart = 0;
    period = 0;
    cycles = 0;
    phase = 0;
    alive = false;
  }

  return { down, up, tick, sample, reset };
}
