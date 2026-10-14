import { audio } from "./sfx";

/**
 * Soft generative background music, synthesized live (no files). Each place has
 * its own scale, tempo and instrument color; night is slower and lower, rain adds
 * a gentle hiss. A scheduler picks notes a little ahead of time so playback stays smooth.
 */

export type Mood = { root: number; scale: number[]; bpm: number; wave: OscillatorType; bright: number };

const PENTA = [0, 2, 4, 7, 9];
const MINOR_PENTA = [0, 3, 5, 7, 10];
const HIJAZ = [0, 1, 4, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

export const MOODS: Record<string, Mood> = {
  hub: { root: 60, scale: PENTA, bpm: 84, wave: "triangle", bright: 1 },
  business: { root: 57, scale: MINOR_PENTA, bpm: 92, wave: "sine", bright: 0.8 },
  skills: { root: 62, scale: LYDIAN, bpm: 100, wave: "square", bright: 0.5 },
  projects: { root: 55, scale: PENTA, bpm: 80, wave: "triangle", bright: 0.9 },
  campus: { root: 60, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 76, wave: "sine", bright: 1 },
  training: { root: 64, scale: PENTA, bpm: 88, wave: "triangle", bright: 1 },
  languages: { root: 62, scale: HIJAZ, bpm: 72, wave: "sine", bright: 0.9 },
  hobbies: { root: 65, scale: PENTA, bpm: 70, wave: "sine", bright: 1.1 },
  arcade: { root: 60, scale: [0, 4, 7, 9, 12], bpm: 120, wave: "square", bright: 0.6 },
};

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

let timer: number | null = null;
let nextAt = 0;
let step = 0;
let mood: Mood = MOODS.hub;
let night = false;
let rainNode: { stop: () => void } | null = null;
let volume = 0.035;

function note(freq: number, at: number, dur: number, wave: OscillatorType, vol: number) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const filter = a.createBiquadFilter();
  const gain = a.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  filter.type = "lowpass";
  filter.frequency.value = (night ? 900 : 1800) * mood.bright;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(filter).connect(gain).connect(a.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function schedule() {
  const a = audio();
  if (!a) return;
  const beat = 60 / (mood.bpm * (night ? 0.8 : 1));
  if (nextAt < a.currentTime) nextAt = a.currentTime + 0.05;
  while (nextAt < a.currentTime + 0.4) {
    const s = mood.scale;
    const bar = Math.floor(step / 8);
    const chordRoot = mood.root - 12 + [0, 5, 7, 3][bar % 4] - (night ? 12 : 0);
    // A soft pad on every bar.
    if (step % 8 === 0) {
      for (const k of [0, 7, 12]) note(midi(chordRoot + k), nextAt, beat * 8, "sine", volume * 0.6);
    }
    // A wandering melody, resting now and then.
    const r = Math.sin(step * 12.9898 + bar * 78.233) * 43758.5453;
    const pick = r - Math.floor(r);
    if (pick > 0.35) {
      const degree = s[Math.floor(pick * 97) % s.length];
      const octave = pick > 0.85 ? 12 : 0;
      note(midi(mood.root + degree + octave - (night ? 12 : 0)), nextAt, beat * (pick > 0.7 ? 2 : 1), mood.wave, volume * (mood.wave === "square" ? 0.35 : 0.8));
    }
    nextAt += beat / 2;
    step++;
  }
}

export const music = {
  start() {
    if (timer !== null || typeof window === "undefined") return;
    timer = window.setInterval(schedule, 120);
  },
  stop() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    rainNode?.stop();
    rainNode = null;
  },
  setMood(key: string, isNight: boolean) {
    mood = MOODS[key] ?? MOODS.hub;
    night = isNight;
  },
  setVolume(v: number) {
    volume = v;
  },
  /** Gentle rain hiss, looped. */
  setRain(on: boolean) {
    if (!on) {
      rainNode?.stop();
      rainNode = null;
      return;
    }
    if (rainNode) return;
    const a = audio();
    if (!a) return;
    const buffer = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = a.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2500;
    filter.Q.value = 0.6;
    const gain = a.createGain();
    gain.gain.value = 0.05;
    src.connect(filter).connect(gain).connect(a.destination);
    src.start();
    rainNode = { stop: () => src.stop() };
  },
};
