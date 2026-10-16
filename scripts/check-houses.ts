// Checks every skill house plan: room sizes, a clear entrance, the centerpiece clear of walls and rooms.
// Run: npx tsx --tsconfig tsconfig.json scripts/check-houses.ts
import { HOUSES } from "@/world/skillHouses/houses";
import { makePlan, roomFrame } from "@/world/skillHouses/plan";
const inside = (r: { x: number; z: number; w: number; d: number }, x: number, z: number, pad = 0) => Math.abs(x - r.x) < r.w / 2 + pad && Math.abs(z - r.z) < r.d / 2 + pad;
for (const [id, h] of Object.entries(HOUSES)) {
  const p = makePlan(h.cut, h.size, h.rooms.length, h.options);
  const probs: string[] = [];
  if (p.rooms.length !== h.rooms.length) probs.push(`rooms ${p.rooms.length}/${h.rooms.length}`);
  const [W, D] = h.size;
  const spawn = [0, D / 2 - 4];
  for (const r of p.rooms) {
    const f = roomFrame(r);
    const min = r.open ? 3.4 : 3.8;
    if (f.w < min || f.d < min) probs.push(`small ${h.rooms[r.slot].label} ${f.w.toFixed(1)}x${f.d.toFixed(1)}`);
    if (inside(r, spawn[0], spawn[1], 0.8)) probs.push(`spawn in ${h.rooms[r.slot].label}`);
    if (inside(r, p.hero[0], p.hero[1], 2)) probs.push(`hero near ${h.rooms[r.slot].label}`);
  }
  for (const w of p.walls) {
    // Walls crossing the entrance strip.
    if (w.axis === "x" && w.at > D / 2 - 5.5 && w.from < 1.5 && w.to > -1.5) probs.push(`wall across entrance at z=${w.at}`);
    if (w.axis === "z" && Math.abs(w.at) < 1.5 && w.to > D / 2 - 5.5) probs.push(`wall along entrance x=${w.at}`);
    // Hero clearance.
    const d = w.axis === "x" ? Math.abs(p.hero[1] - w.at) : Math.abs(p.hero[0] - w.at);
    const along = w.axis === "x" ? p.hero[0] : p.hero[1];
    if (d < 2.6 && along > w.from - 2 && along < w.to + 2) probs.push(`hero ${d.toFixed(1)}m from wall`);
  }
  if (Math.abs(p.hero[1] - spawn[1]) < 4 && Math.abs(p.hero[0]) < 3) probs.push(`hero at spawn`);
  const sizes = p.rooms.map((r) => { const f = roomFrame(r); return `${f.w.toFixed(1)}x${f.d.toFixed(1)}${r.open ? "o" : ""}`; }).join(" ");
  console.log(`${id.padEnd(14)} ${h.cut.padEnd(9)} hall ${p.hall.w.toFixed(1)}x${p.hall.d.toFixed(1)} hero(${p.hero.map((v) => v.toFixed(1))}) | ${sizes}${probs.length ? "  !! " + probs.join("; ") : ""}`);
}
