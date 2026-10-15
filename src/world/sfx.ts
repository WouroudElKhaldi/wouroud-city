/**
 * Tiny synthesized sound effects (no audio files to download).
 * Everything goes through one AudioContext created on the first user gesture.
 */

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

export function audio() {
  if (muted || typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.15, slideTo?: number, delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function noise(duration: number, volume = 0.12, filterFreq = 1200, delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * duration), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const gain = a.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t);
}

/** A short generated lo-fi phrase: a different melody for every seed (Hyperfocus's music player). */
function track(seed: number) {
  const scales = [
    [261.6, 293.7, 329.6, 392, 440, 523.3],
    [220, 246.9, 261.6, 329.6, 392, 440],
    [293.7, 329.6, 349.2, 440, 493.9, 587.3],
  ];
  const scale = scales[seed % scales.length];
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 16; i++) {
    const note = scale[Math.floor(rnd() * scale.length)];
    tone(note, 0.32, "triangle", 0.07, undefined, i * 0.3);
    if (i % 4 === 0) tone(scale[0] / 2, 1.1, "sine", 0.06, undefined, i * 0.3);
  }
}

export const sfx = {
  track,
  rustle: () => noise(0.35, 0.1, 2400),
  pop: () => tone(520, 0.12, "triangle", 0.18, 900),
  kick: () => {
    tone(140, 0.12, "sine", 0.3, 60);
    noise(0.06, 0.12, 900);
  },
  clunk: () => {
    tone(180, 0.15, "square", 0.08, 90);
    noise(0.1, 0.1, 600);
  },
  coin: () => {
    tone(988, 0.08, "square", 0.08);
    tone(1319, 0.25, "square", 0.08, undefined, 0.08);
  },
  splash: () => noise(0.5, 0.16, 1800, 0.55),
  honk: () => {
    tone(330, 0.28, "sawtooth", 0.07);
    tone(415, 0.28, "sawtooth", 0.07);
  },
  chirp: () => {
    tone(2200, 0.06, "sine", 0.06, 3200);
    tone(2600, 0.06, "sine", 0.06, 3600, 0.09);
  },
  click: () => tone(1200, 0.04, "square", 0.05),
  sparkle: () => {
    [1568, 2093, 2637].forEach((f, i) => tone(f, 0.18, "sine", 0.05, undefined, i * 0.06));
  },
  gong: () => {
    [98, 147, 196, 262, 311].forEach((f, i) => tone(f, 3 - i * 0.4, "sine", 0.14 / (i + 1), f * 0.985));
    noise(0.25, 0.08, 500);
  },
  vault: () => {
    [0, 0.09, 0.18, 0.27].forEach((d) => tone(1800, 0.03, "square", 0.04, undefined, d));
    tone(160, 0.35, "square", 0.07, 70, 0.45);
    noise(0.3, 0.1, 500, 0.45);
  },
  talk: () => {
    [300, 360, 280, 340].forEach((f, i) => tone(f, 0.07, "triangle", 0.06, undefined, i * 0.08));
  },
};
