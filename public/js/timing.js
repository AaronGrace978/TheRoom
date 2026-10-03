// A breath around ten seconds is the center of the room.
// The ending is unhurried on purpose: gathering, then dawn, then a long fall to black.

export const DEFAULT_TIMING = {
  holdMs: 16000,
  graceMs: 1800,
  threshold: 0.74,
  release: 0.6,
  dawnMs: 16000,
  peakMs: 3200,
  fadeMs: 15000,
};

export function timingFromSearch(search = "") {
  const params = new URLSearchParams(search);
  if (params.get("swift") !== "1") return { ...DEFAULT_TIMING };
  return {
    ...DEFAULT_TIMING,
    holdMs: 4500,
    graceMs: 700,
    dawnMs: 6500,
    peakMs: 1400,
    fadeMs: 6500,
  };
}
