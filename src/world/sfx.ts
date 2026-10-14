/**
 * Tiny synthesized sound effects (no audio files to download).
 * Everything goes through one AudioContext created on the first user gesture.
 */

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

function audio() {
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

export const sfx = {
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
  talk: () => {
    [300, 360, 280, 340].forEach((f, i) => tone(f, 0.07, "triangle", 0.06, undefined, i * 0.08));
  },
};
