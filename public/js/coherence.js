// The room brightens when several breaths share one slow tempo.
// Phase matters, but less than slowness and agreement: a rhythm can be shared
// before every inhale falls on the same instant.

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function average(values) {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

export function coherence(souls) {
  const group = (souls || []).filter(
    (soul) =>
      soul &&
      soul.fresh &&
      soul.cycles >= 2 &&
      soul.period >= 2500 &&
      soul.period <= 20000 &&
      Number.isFinite(soul.phase),
  );

  if (group.length < 2) {
    return { score: 0, slowness: 0, agreement: 0, lock: 0, together: 0, count: group.length, mean: 0 };
  }

  const periods = group.map((soul) => soul.period);
  const mean = average(periods);
  const slowness = Math.exp(-0.5 * ((mean - 10000) / 2400) ** 2);
  const spread = Math.sqrt(average(periods.map((period) => (period - mean) ** 2)));
  const agreement = clamp01(1 - spread / mean / 0.22);

  let x = 0;
  let y = 0;
  for (const soul of group) {
    const angle = (((soul.phase % 1) + 1) % 1) * Math.PI * 2;
    x += Math.cos(angle);
    y += Math.sin(angle);
  }
  const lock = Math.hypot(x, y) / group.length;
  const together = agreement * 0.75 + lock * 0.25;
  const score = Math.sqrt(clamp01(slowness) * clamp01(together));

  return { score, slowness, agreement, lock, together, count: group.length, mean };
}
