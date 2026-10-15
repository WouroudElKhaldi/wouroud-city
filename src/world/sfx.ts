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

/** A cricket: a few quick high chirps. */
function cricket() {
  for (let i = 0; i < 3; i++) tone(4200 + Math.random() * 300, 0.04, "sine", 0.02, undefined, i * 0.09);
}

/** A songbird: a short rising and falling trill. */
function songbird() {
  const base = 2200 + Math.random() * 900;
  for (let i = 0; i < 4; i++) tone(base + (i % 2) * 500, 0.07, "sine", 0.025, base * 1.2, i * 0.11);
}

/** A friendly dog: two short barks. */
function bark() {
  [0, 0.22].forEach((d) => {
    tone(520, 0.09, "sawtooth", 0.06, 300, d);
    noise(0.08, 0.05, 900, d);
  });
}

/**
 * A street musician's phrase on a plucked string, in maqam hijaz (D, E-flat, F-sharp, G, A, B-flat, C):
 * a different little tune for every seed.
 */
function busk(seed: number) {
  const hijaz = [293.7, 311.1, 370, 392, 440, 466.2, 523.3, 587.3];
  let s = seed * 7919 + 13;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let i = Math.floor(rnd() * 3) + 2;
  for (let n = 0; n < 14; n++) {
    i = Math.max(0, Math.min(hijaz.length - 1, i + Math.floor(rnd() * 5) - 2));
    const t = n * 0.22 + (n % 4 === 3 ? 0.08 : 0);
    tone(hijaz[i], 0.5, "triangle", 0.07, hijaz[i] * 0.995, t);
    tone(hijaz[i] * 2, 0.18, "sine", 0.02, undefined, t);
    if (n % 4 === 0) tone(146.8, 0.8, "triangle", 0.05, undefined, t);
  }
  tone(293.7, 1.2, "triangle", 0.07, undefined, 14 * 0.22 + 0.1);
}

/** A bus arriving at the stop: the brakes sigh and the door bell rings. */
function bus() {
  noise(0.7, 0.07, 3000);
  tone(880, 0.25, "sine", 0.05, undefined, 0.6);
  tone(660, 0.35, "sine", 0.05, undefined, 0.85);
}

export const sfx = {
  track,
  bark,
  busk,
  bus,
  cricket,
  songbird,
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
