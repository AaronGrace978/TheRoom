// A small fire, made here, never loaded. It follows the flame and dies with it.

function brownNoise() {
  const length = 2 * 44100;
  const buffer = new Float32Array(length);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    buffer[i] = last * 3.2;
  }
  return buffer;
}

export function createSound() {
  let context = null;
  let master = null;
  let hiss = null;
  let drone = null;
  let fifth = null;
  let started = false;
  let crackleAt = 0;

  function ensure() {
    if (context) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    context = new Ctx();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const noiseBuffer = context.createBuffer(1, 44100 * 2, 44100);
    noiseBuffer.copyToChannel(brownNoise(), 0);
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 640;
    filter.Q.value = 0.7;
    hiss = context.createGain();
    hiss.gain.value = 0;
    source.connect(filter);
    filter.connect(hiss);
    hiss.connect(master);
    source.start();

    drone = context.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 98;
    const droneGain = context.createGain();
    droneGain.gain.value = 0;
    drone.connect(droneGain);
    droneGain.connect(master);
    drone.start();
    drone.level = droneGain;

    fifth = context.createOscillator();
    fifth.type = "sine";
    fifth.frequency.value = 147;
    const fifthGain = context.createGain();
    fifthGain.gain.value = 0;
    fifth.connect(fifthGain);
    fifthGain.connect(master);
    fifth.start();
    fifth.level = fifthGain;
    return true;
  }

  async function begin() {
    if (started) return;
    if (!ensure()) return;
    started = true;
    try {
      await context.resume();
    } catch {
      started = false;
    }
  }

  function follow({ fullness, light, darkness, now }) {
    if (!started || !context) return;
    const alive = (1 - darkness) ** 1.4;
    const targetMaster = 0.22 * alive;
    master.gain.setTargetAtTime(targetMaster, context.currentTime, 0.4);
    hiss.gain.setTargetAtTime(0.03 * (0.25 + fullness * 0.75) * alive, context.currentTime, 0.25);
    drone.level.gain.setTargetAtTime(0.018 * Math.max(0, light - 0.2) * alive, context.currentTime, 0.6);
    fifth.level.gain.setTargetAtTime(light > 0.65 ? 0.008 * alive : 0, context.currentTime, 0.8);

    if (alive > 0.2 && fullness > 0.35 && now > crackleAt) {
      crackleAt = now + 1800 + Math.random() * 4200;
      const burst = context.createBufferSource();
      const samples = Math.floor(context.sampleRate * 0.09);
      const buffer = context.createBuffer(1, samples, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < samples; i += 1) {
        const env = Math.exp(-i / (samples * 0.22));
        data[i] = (Math.random() * 2 - 1) * env;
      }
      burst.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = 0.012 * alive;
      const band = context.createBiquadFilter();
      band.type = "highpass";
      band.frequency.value = 900;
      burst.connect(band);
      band.connect(gain);
      gain.connect(master);
      burst.start();
    }
  }

  function close() {
    if (!context) return;
    master.gain.setTargetAtTime(0, context.currentTime, 0.2);
    const dying = context;
    context = null;
    started = false;
    setTimeout(() => {
      dying.close().catch(() => {});
    }, 600);
  }

  return { begin, follow, close };
}
