import { DEFAULT_TIMING } from "./timing.js";

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function createRitual(timing = DEFAULT_TIMING) {
  let mode = "night";
  let holdFor = 0;
  let belowFor = 0;
  let elapsed = 0;

  function lightFor() {
    const gathered = clamp01(holdFor / timing.holdMs) * 0.22;
    if (mode === "night") return gathered;
    if (mode === "dawn") return 0.22 + 0.78 * smoothstep(elapsed / timing.dawnMs);
    return 1;
  }

  function darknessFor() {
    if (mode === "black") return 1;
    if (mode !== "fade") return 0;
    const fadeAt = timing.dawnMs + timing.peakMs;
    return clamp01((elapsed - fadeAt) / timing.fadeMs);
  }

  function enterDawn() {
    if (mode !== "night") return false;
    mode = "dawn";
    elapsed = 0;
    return true;
  }

  function update(score, dt) {
    const step = Math.max(0, dt);
    let justDawned = false;

    if (mode === "night") {
      if (score >= timing.threshold) {
        belowFor = 0;
        holdFor += step * 1000;
        if (holdFor >= timing.holdMs) justDawned = enterDawn();
      } else if (score < timing.release) {
        belowFor += step * 1000;
        if (belowFor >= timing.graceMs) {
          holdFor = 0;
          belowFor = 0;
        }
      }
    } else if (mode !== "black") {
      elapsed += step * 1000;
      const peakAt = timing.dawnMs;
      const fadeAt = peakAt + timing.peakMs;
      const blackAt = fadeAt + timing.fadeMs;
      if (elapsed >= blackAt) mode = "black";
      else if (elapsed >= fadeAt) mode = "fade";
      else if (elapsed >= peakAt) mode = "peak";
      else mode = "dawn";
    }

    return {
      mode,
      light: lightFor(),
      darkness: darknessFor(),
      justDawned,
      hold: clamp01(holdFor / timing.holdMs),
      done: mode === "black",
    };
  }

  function reset() {
    mode = "night";
    holdFor = 0;
    belowFor = 0;
    elapsed = 0;
  }

  return {
    update,
    beginDawn: enterDawn,
    reset,
    get mode() {
      return mode;
    },
  };
}
