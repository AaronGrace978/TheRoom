import { createBreath } from "./breath.js";
import { coherence } from "./coherence.js";
import { createRoom, personalityOf } from "./flame.js";
import { createMesh } from "./mesh.js";
import { createNet } from "./net.js";
import { createRitual } from "./ritual.js";
import { createSound } from "./sound.js";
import { timingFromSearch } from "./timing.js";

const INSTRUCTION = "Hold the glass as you breathe in.\nLet go as you breathe out.";
const TOGETHER = "Let it become the same slow breath.";

const canvas = document.getElementById("room");
const glass = document.getElementById("glass");
const words = document.getElementById("words");
const again = document.getElementById("again");
const room = createRoom(canvas);

let session = null;
let wordText = "";
let wordVariant = "";
let wordTimer = 0;

function showWords(text, variant = "") {
  if (text === wordText && variant === wordVariant) return;
  const previous = wordText;
  wordText = text;
  wordVariant = variant;
  window.clearTimeout(wordTimer);
  const apply = () => {
    words.textContent = text;
    words.classList.toggle("end", variant === "end");
    words.style.opacity = text ? "1" : "0";
  };
  if (previous) {
    words.style.opacity = "0";
    wordTimer = window.setTimeout(apply, 680);
  } else {
    apply();
  }
}

function createSession() {
  const timing = timingFromSearch(location.search);
  const id = crypto.randomUUID();
  const breath = createBreath();
  const ritual = createRitual(timing);
  const sound = createSound();
  const personality = personalityOf(id);
  let net;
  const mesh = createMesh(id, {
    send(to, data) {
      net.sendSignal(to, data);
    },
    onDawn() {
      ritual.beginDawn();
    },
  });
  net = createNet(id, mesh);

  let dead = false;
  let last = performance.now();
  let catchProgress = 0;
  let lastSend = 0;
  let wiped = false;
  let blackFor = 0;
  let breathed = false;
  let sawPeer = false;
  let peerAnnounceUntil = 0;
  let instructionUntil = 0;
  let togetherUntil = 0;
  let firstUntil = 0;
  let unreachableUntil = 0;
  let wakeLock = null;
  const pointers = new Set();

  glass.setAttribute("aria-pressed", "false");

  function pointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (ritual.mode === "black") return;
    pointers.add(event.pointerId);
    glass.setPointerCapture?.(event.pointerId);
    breath.down(performance.now());
    breathed = true;
    glass.setAttribute("aria-pressed", "true");
    sound.begin();
    stayAwake();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }

  function pointerUp(event) {
    pointers.delete(event.pointerId);
    if (pointers.size === 0) {
      breath.up(performance.now());
      glass.setAttribute("aria-pressed", "false");
    }
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    if (event.code !== "Space" && event.code !== "Enter") return;
    if (document.activeElement === again) return;
    event.preventDefault();
    if (ritual.mode === "black") return;
    breath.down(performance.now());
    breathed = true;
    glass.setAttribute("aria-pressed", "true");
    sound.begin();
    stayAwake();
  }

  function onKeyUp(event) {
    if (event.code !== "Space" && event.code !== "Enter") return;
    breath.up(performance.now());
    glass.setAttribute("aria-pressed", "false");
  }

  async function stayAwake() {
    if (wakeLock || !navigator.wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch {
      wakeLock = null;
    }
  }

  function narrate(now, view) {
    if (view.mode === "black") {
      if (blackFor > 1.8 && blackFor < 8.6) showWords("Nothing was kept.", "end");
      else showWords("", "end");
      const showAgain = blackFor > 7.2;
      again.hidden = !showAgain;
      again.classList.toggle("visible", showAgain);
      return;
    }
    again.hidden = true;
    again.classList.remove("visible");

    const peers = mesh.count();
    if (peers > 0 && !sawPeer) {
      sawPeer = true;
      peerAnnounceUntil = now + 4200;
    }
    if (catchProgress > 0.86 && instructionUntil === 0 && !breathed) instructionUntil = now + 12000;
    if (breathed && togetherUntil === 0 && peers > 0 && breath.sample().cycles >= 1) togetherUntil = now + 6200;
    if (breathed && firstUntil === 0 && peers === 0 && catchProgress > 0.92 && now > (instructionUntil || 0)) {
      firstUntil = now + 5600;
    }

    if (now < peerAnnounceUntil) {
      showWords(peers > 1 ? "Other candles." : "Another candle.");
      return;
    }
    if (!breathed && instructionUntil && now < instructionUntil && catchProgress > 0.8) {
      showWords(INSTRUCTION);
      return;
    }
    if (togetherUntil && now < togetherUntil && peers > 0) {
      showWords(TOGETHER);
      return;
    }
    if (firstUntil && now < firstUntil && peers === 0) {
      showWords("Your candle is the first.");
      return;
    }
    if (!window.isSecureContext && unreachableUntil === 0 && catchProgress >= 1 && peers === 0) {
      unreachableUntil = now + 6400;
    }
    if (unreachableUntil && now < unreachableUntil && peers === 0) {
      showWords("The others are somewhere this glass can’t reach.");
      return;
    }
    showWords("");
  }

  let rafId = 0;
  let lastTick = 0;

  function loop(now) {
    if (dead || now - lastTick < 12) return;
    lastTick = now;
    try {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (catchProgress < 1) catchProgress = Math.min(1, catchProgress + dt / 3.05);

    breath.tick(dt, now);
    mesh.tick(dt);
    const mine = breath.sample();
    const reading = coherence([mine, ...mesh.souls()]);
    const view = ritual.update(reading.score, dt);

    if (view.justDawned) mesh.announceDawn();
    if (view.mode === "black") blackFor += dt;
    else blackFor = 0;

    if (!wiped && view.mode === "black") {
      wiped = true;
      mesh.close();
      net.forget();
      breath.reset();
      sound.close();
      room.clear();
      wakeLock?.release?.().catch(() => {});
      wakeLock = null;
      pointers.clear();
    }

    if (!wiped && now - lastSend > 110) {
      lastSend = now;
      mesh.broadcast(mine);
    }

    room.draw(now, {
      dt,
      catch: catchProgress,
      light: view.light,
      darkness: view.darkness,
      selfFullness: wiped ? 0 : mine.fullness,
      selfPersonality: personality,
      others: wiped ? [] : mesh.visuals(),
    });
    if (!wiped) sound.follow({ fullness: mine.fullness, light: view.light, darkness: view.darkness, now });
    narrate(now, view);
    } catch (error) {
      console.error(error);
    }
    if (!dead) rafId = requestAnimationFrame(loop);
  }

  window.addEventListener("pointerdown", pointerDown);
  window.addEventListener("pointerup", pointerUp);
  window.addEventListener("pointercancel", pointerUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  net.connect();
  rafId = requestAnimationFrame(loop);
  const watchdog = window.setInterval(() => {
    if (!dead && performance.now() - lastTick > 80) loop(performance.now());
  }, 100);

  return {
    destroy() {
      dead = true;
      cancelAnimationFrame(rafId);
      clearInterval(watchdog);
      window.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (!wiped) {
        mesh.close();
        net.forget();
        sound.close();
        wakeLock?.release?.().catch(() => {});
      }
      breath.reset();
      room.clear();
      pointers.clear();
    },
  };
}

function relight() {
  session?.destroy();
  showWords("");
  again.hidden = true;
  again.classList.remove("visible");
  session = createSession();
  glass.focus({ preventScroll: true });
}

again.addEventListener("click", (event) => {
  event.stopPropagation();
  relight();
});

window.addEventListener("resize", () => room.resize());
window.addEventListener("contextmenu", (event) => event.preventDefault());
glass.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });

session = createSession();
glass.focus({ preventScroll: true });
