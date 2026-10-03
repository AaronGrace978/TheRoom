// One canvas, one room. Your candle is near, the others further back in the dark.
// Light is drawn additively; the last veil is true black.

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function hashString(id) {
  let hash = 2166136261;
  const text = String(id || "you");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    return ((hash >>> 0) % 100000) / 100000;
  };
}

export function personalityOf(id) {
  const rand = hashString(id);
  return {
    hue: (rand() - 0.5) * 18,
    tall: 0.88 + rand() * 0.28,
    wide: 0.86 + rand() * 0.28,
    flicker: 0.55 + rand() * 0.9,
    lean: (rand() - 0.5) * 0.55,
  };
}

function noise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = fract(Math.sin(i * 127.1) * 43758.5453);
  const b = fract(Math.sin((i + 1) * 127.1) * 43758.5453);
  return a * (1 - u) + b * u;
}

function fract(value) {
  return value - Math.floor(value);
}

function fbm(x) {
  return noise(x) * 0.55 + noise(x * 2.13) * 0.28 + noise(x * 4.27) * 0.17;
}

function catchEnvelope(progress, reduced) {
  if (progress <= 0) return 0;
  if (reduced) return smoothstep(Math.min(1, progress / 0.55));
  if (progress < 0.16) return smoothstep(progress / 0.16) * 0.34;
  if (progress < 0.28) return 0.34 - ((progress - 0.16) / 0.12) * 0.2;
  return 0.14 + smoothstep((progress - 0.28) / 0.72) * 0.86;
}

function makeGrain() {
  const grain = document.createElement("canvas");
  grain.width = 160;
  grain.height = 160;
  const context = grain.getContext("2d");
  const image = context.createImageData(160, 160);
  for (let i = 0; i < image.data.length; i += 4) {
    const shade = 180 + Math.random() * 75;
    image.data[i] = shade;
    image.data[i + 1] = shade * 0.9;
    image.data[i + 2] = shade * 0.75;
    image.data[i + 3] = 46;
  }
  context.putImageData(image, 0, 0);
  return grain;
}

function layout(width, height, others) {
  const base = Math.min(Math.min(width, height) / 460, width / 390, 1.5);
  const self = {
    x: width / 2,
    y: height * (height < 700 ? 0.62 : 0.58),
    scale: base * 1.24,
    depth: 1,
    self: true,
  };
  const count = others.length;
  const placed = others.map((other, index) => {
    const offset = count === 1 ? -0.78 : -1.2 + (2.4 * index) / (count - 1);
    const rx = Math.min(width * 0.36, 300 * base);
    const drop = Math.min(height * 0.08, 70 * base);
    return {
      ...other,
      x: width / 2 + Math.sin(offset) * rx,
      y: height * 0.34 + Math.abs(offset) * drop,
      scale: base * (0.48 - Math.min(0.12, Math.abs(offset) * 0.05)),
      depth: 0.72,
      self: false,
      order: Math.abs(offset),
    };
  });
  placed.sort((a, b) => b.order - a.order);
  return { self, others: placed };
}

function flameProfile(t) {
  if (t < 0.2) return 0.42 + (t / 0.2) * 0.58;
  return ((1 - (t - 0.2) / 0.8) ** 1.45);
}

function traceFlame(ctx, x, y, width, height, time, seed) {
  const steps = 28;
  ctx.beginPath();
  for (let side = -1; side <= 1; side += 2) {
    const forward = side === -1;
    for (let step = 0; step <= steps; step += 1) {
      const i = forward ? step : steps - step;
      const t = i / steps;
      const half = width * flameProfile(t) * (side === -1 ? 1 : 0.94);
      const flutter = (fbm(t * 3.1 + time * 0.0018 + seed + side * 2) - 0.5) * width * 0.62 * (0.3 + t);
      const lean = (fbm(time * 0.0008 + seed) - 0.5) * width * 1.3 * t * t;
      const px = x + side * half + flutter + lean;
      const py = y - height * t ** 0.96;
      if (side === -1 && step === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

function paintFlame(ctx, x, y, width, height, time, seed, stops) {
  traceFlame(ctx, x, y, width, height, time, seed);
  const gradient = ctx.createLinearGradient(x, y - height, x, y + 6);
  for (const [stop, color] of stops) gradient.addColorStop(stop, color);
  ctx.fillStyle = gradient;
  ctx.fill();
}

function drawLight(ctx, candle, alpha) {
  const { x, y, scale, shown, presence } = candle;
  const lift = (26 + shown * 90) * scale;
  const radius = (70 + shown * 150) * scale * (candle.self ? 1.35 : 0.85);
  const strength = alpha * presence * (0.16 + shown * 0.5) * (candle.self ? 1 : 0.55);
  const glow = ctx.createRadialGradient(x, y - lift * 0.55, 0, x, y - lift * 0.35, radius);
  glow.addColorStop(0, `rgba(255, 176, 82, ${strength})`);
  glow.addColorStop(0.35, `rgba(255, 120, 40, ${strength * 0.45})`);
  glow.addColorStop(1, "rgba(255, 80, 20, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - lift * 0.45, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawBody(ctx, candle, time, dying, reduced) {
  const { x, y, scale, shown, personality, presence, self } = candle;
  const alpha = presence * (self ? 1 : 0.92);
  if (alpha <= 0.01 || shown <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(personality.lean * 10 * scale, 0);

  const waxH = 78 * scale;
  const topW = 17 * scale;
  const botW = 21 * scale;
  ctx.save();
  ctx.translate(x, y + waxH + 3 * scale);
  ctx.scale(1, 0.22);
  ctx.beginPath();
  ctx.arc(0, 0, botW * 2.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
  ctx.fill();
  ctx.restore();
  const body = ctx.createLinearGradient(x - botW, y, x + botW, y);
  body.addColorStop(0, "#3a2416");
  body.addColorStop(0.28, "#8d5a38");
  body.addColorStop(0.48, "#c49262");
  body.addColorStop(0.7, "#7a4e32");
  body.addColorStop(1, "#2a1810");
  ctx.beginPath();
  ctx.moveTo(x - topW, y);
  ctx.lineTo(x + topW * 0.92, y);
  ctx.lineTo(x + botW, y + waxH);
  ctx.quadraticCurveTo(x, y + waxH + 7 * scale, x - botW * 0.96, y + waxH);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();

  const rim = ctx.createLinearGradient(x, y, x, y + 18 * scale);
  rim.addColorStop(0, `rgba(255, ${170 - dying * 70}, ${90 - dying * 40}, ${0.28 + shown * 0.2})`);
  rim.addColorStop(1, "rgba(255, 120, 40, 0)");
  ctx.fillStyle = rim;
  ctx.fillRect(x - topW, y, topW * 2, 16 * scale);

  ctx.beginPath();
  ctx.ellipse(x, y, topW * 0.98, topW * 0.36, 0, 0, Math.PI * 2);
  const pool = ctx.createRadialGradient(x - 2 * scale, y - 1.5 * scale, 1, x, y, topW);
  const hot = Math.round(255 - dying * 40);
  const mid = Math.round(190 - dying * 80);
  pool.addColorStop(0, `rgb(${hot}, ${Math.round(214 - dying * 90)}, ${Math.round(150 - dying * 80)})`);
  pool.addColorStop(0.42, `rgb(${mid}, ${Math.round(112 - dying * 50)}, ${Math.round(48 - dying * 20)})`);
  pool.addColorStop(1, "#5a2c12");
  ctx.fillStyle = pool;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x, y, topW * 1.02, topW * 0.4, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(30, 12, 6, 0.65)";
  ctx.lineWidth = Math.max(1, scale);
  ctx.stroke();

  ctx.save();
  ctx.translate(x + personality.lean * 2 * scale, y);
  ctx.rotate(personality.lean * 0.25);
  ctx.fillStyle = "#120c09";
  ctx.fillRect(-0.7 * scale, -15 * scale, 1.5 * scale, 16 * scale);
  ctx.beginPath();
  ctx.arc(0.1 * scale, -15 * scale, 1.7 * scale, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, ${90 + shown * 80}, 40, 0.95)`;
  ctx.fill();
  ctx.restore();

  const nervous = (reduced ? 0.2 : 1) * personality.flicker;
  const seed = personality.hue + 4;
  const bob = 0.96 + (fbm(time * 0.001 * nervous + seed) - 0.45) * 0.07 * nervous;
  const height = (46 + shown * 92) * scale * personality.tall * bob * (1 - dying * 0.25);
  const width = (18 + shown * 10) * scale * personality.wide;
  const baseY = y - 13 * scale;
  const gold = Math.round(168 - dying * 80);
  const cream = Math.round(236 - dying * 50);

  ctx.save();
  ctx.filter = reduced ? "none" : `blur(${2.2 * Math.min(scale, 1.5)}px)`;
  paintFlame(ctx, x, baseY, width * 1.7, height * 1.04, time * nervous, seed, [
    [0, "rgba(255, 80, 10, 0)"],
    [0.25, `rgba(255, ${Math.round(gold * 0.7)}, 20, 0.28)`],
    [0.7, "rgba(255, 70, 10, 0.22)"],
    [1, "rgba(120, 30, 6, 0)"],
  ]);
  ctx.filter = "none";
  ctx.restore();

  paintFlame(ctx, x, baseY, width, height, time * nervous, seed + 1, [
    [0, "rgba(255, 70, 12, 0)"],
    [0.14, `rgba(255, ${Math.round(96 - dying * 30)}, 18, 0.55)`],
    [0.38, `rgba(255, ${gold}, 32, 0.95)`],
    [0.62, `rgba(255, ${cream}, ${Math.round(130 - dying * 40)}, 1)`],
    [0.84, `rgba(255, 248, 220, ${0.92})`],
    [1, `rgba(255, ${Math.round(186 - dying * 30)}, 70, 1)`],
  ]);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.beginPath();
  ctx.ellipse(x, baseY - 1 * scale, Math.max(1.2, 2.2 * scale), 3.2 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, ${Math.round(210 - dying * 40)}, 120, ${0.35 + shown * 0.4})`;
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawEmbers(ctx, list) {
  for (const ember of list) {
    const fade = 1 - ember.life / ember.max;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, ${180 + fade * 50}, 90, ${fade * 0.85})`;
    ctx.arc(ember.x, ember.y, ember.size * fade, 0, Math.PI * 2);
    ctx.fill();
  }
}

function stepEmbers(list, dt, x, y, shown, scale, allow) {
  if (allow && shown > 0.25 && list.length < 16 && Math.random() < dt * shown * 2.4) {
    list.push({
      x: x + (Math.random() - 0.5) * 10 * scale,
      y: y - (20 + shown * 30) * scale,
      vx: (Math.random() - 0.5) * 8,
      vy: -16 - Math.random() * 22,
      life: 0,
      max: 0.7 + Math.random() * 1.15,
      size: (0.7 + Math.random() * 1.3) * Math.max(0.6, scale),
    });
  }
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const ember = list[i];
    ember.life += dt;
    ember.x += ember.vx * dt;
    ember.y += ember.vy * dt;
    ember.vy -= 6 * dt;
    if (ember.life >= ember.max) list.splice(i, 1);
  }
}

export function createRoom(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const grain = makeGrain();
  const smoothed = new Map();
  const embers = new Map();
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  let width = 1;
  let height = 1;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function easeFullness(id, target, dt) {
    const prev = smoothed.get(id) ?? target;
    const next = prev + (target - prev) * (1 - Math.exp(-dt * 7.5));
    smoothed.set(id, next);
    return next;
  }

  function draw(now, scene) {
    const catchMul = catchEnvelope(scene.catch, reduced);
    const dying = clamp01(scene.darkness * 1.05);
    const light = scene.light * (1 - dying * 0.15);
    const unity = clamp01((scene.light - 0.28) / 0.72);
    const shared = reduced ? 0.85 : 0.78 + 0.22 * Math.sin(now / 980);

    const present = (value) => 0.34 + clamp01(value) * 0.66;
    const others = (scene.others || []).map((other) => {
      const visual = easeFullness(other.id, present(other.fullness ?? 0.15), scene.dt);
      const shown = (visual * (1 - unity) + shared * unity) * catchMul;
      return { ...other, personality: other.personality || personalityOf(other.id), shown };
    });
    const places = layout(width, height, others);
    const selfVisual = easeFullness("self", present(scene.selfFullness ?? 0), scene.dt);
    const selfShown = (selfVisual * (1 - unity) + Math.max(selfVisual, shared) * unity) * catchMul;
    const self = {
      ...places.self,
      id: "self",
      shown: selfShown,
      presence: 1,
      personality: scene.selfPersonality,
    };
    const candles = [...places.others, self];

    const voidColor = [8, 6, 5];
    const amber = [48, 24, 12];
    const warm = voidColor.map((channel, index) => channel + (amber[index] - channel) * clamp01(light * 0.9));
    ctx.fillStyle = `rgb(${warm[0] | 0}, ${warm[1] | 0}, ${warm[2] | 0})`;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const candle of candles) drawLight(ctx, candle, 1 - scene.darkness);
    if (light > 0.08) {
      const wash = ctx.createRadialGradient(width / 2, height * 0.58, 40, width / 2, height * 0.5, Math.max(width, height) * 0.72);
      const alpha = light ** 1.5 * 0.28;
      wash.addColorStop(0, `rgba(255, 176, 84, ${alpha})`);
      wash.addColorStop(0.55, `rgba(180, 70, 16, ${alpha * 0.35})`);
      wash.addColorStop(1, "rgba(80, 20, 4, 0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();

    for (const candle of candles) drawBody(ctx, candle, now, dying, reduced);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const candle of candles) {
      const bag = embers.get(candle.id) || [];
      embers.set(candle.id, bag);
      stepEmbers(bag, scene.dt, candle.x, candle.y, candle.shown, candle.scale, !reduced && scene.darkness < 0.45 && candle.presence > 0.4);
      drawEmbers(ctx, bag);
    }
    ctx.restore();

    if (scene.darkness < 0.92) {
      ctx.save();
      ctx.globalAlpha = 0.045 * (1 - scene.darkness);
      const shift = Math.floor(now / 180) % 40;
      for (let y = -40; y < height; y += 160) {
        for (let x = -40; x < width; x += 160) ctx.drawImage(grain, x + shift, y);
      }
      ctx.restore();
    }

    const vignette = ctx.createRadialGradient(width / 2, height * 0.52, height * 0.18, width / 2, height * 0.5, height * 0.72);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, `rgba(0,0,0,${0.62 - light * 0.28})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    if (scene.darkness > 0) {
      const veil = scene.darkness ** 2.15;
      ctx.fillStyle = `rgba(0,0,0,${veil})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function clear() {
    smoothed.clear();
    embers.clear();
  }

  resize();
  return { draw, resize, clear };
}
