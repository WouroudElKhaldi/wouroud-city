/**
 * Floor plans for the skill houses. A plan is pure data: the main hall (where the skill's centerpiece
 * stands), the rooms around it and the interior walls with their doorways. The entrance is always in
 * the middle of the front wall (+z), and the player arrives 4 m inside it, facing the back (-z).
 *
 * Each "cut" is a different way to divide a building, and its options (proportions, mirroring, wall
 * style, how many rooms) make every house's plan its own:
 *  - atrium: a tall central hall running front to back, rooms opening off both sides
 *  - corridor: a lobby, a spine with rooms either side, a great hall across the back
 *  - loft: one open space, glass rooms along the back, open zones along the sides
 *  - enfilade: a front hall, then a row of rooms along the back connected door to door
 *  - ring: a walled core in the middle (the centerpiece inside), rooms in the four corners
 *  - nested: rings of walls inside each other (CSS's box model: margin, border, padding, content)
 *  - warehouse: a big open shed with a row of offices along one wall
 */

export type Side = "n" | "s" | "e" | "w";
export type Rect = { x: number; z: number; w: number; d: number };
export type WallStyle = "solid" | "glass" | "frame" | "half" | "shelf";
export type Cut = "atrium" | "corridor" | "loft" | "enfilade" | "ring" | "nested" | "warehouse";

export type PlanWall = {
  /** "x": runs along x at z = at (from/to are x); "z": runs along z at x = at (from/to are z) */
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
  /** Doorway centers along the wall */
  doors: number[];
  style: WallStyle;
};

export type PlanRoom = Rect & {
  /** Which room of the house's list goes here */
  slot: number;
  /** The side its doorway (or its open edge) faces */
  door: Side;
  /** An open zone (no walls of its own) */
  open: boolean;
};

export type Platform = Rect & {
  /** Height of the deck */
  y: number;
  /** The side the ramp comes down, and the ramp's center along that edge */
  ramp: Side;
  rampAt: number;
};

export type Plan = {
  W: number;
  D: number;
  H: number;
  hall: Rect;
  /** Where the centerpiece stands */
  hero: [number, number];
  rooms: PlanRoom[];
  walls: PlanWall[];
  platforms: Platform[];
};

export type CutOptions = {
  /** Fraction of the width taken by the central hall (atrium) or the core (ring) */
  hall?: number;
  /** Depth of a front lobby band (corridor) or the front hall (enfilade) */
  front?: number;
  /** Depth of the back hall (corridor) or the back rooms (loft) */
  back?: number;
  /** Width of the spine (corridor) or the office row (warehouse) */
  spine?: number;
  /** Swap left and right */
  mirror?: boolean;
  /** Style of the room walls */
  style?: WallStyle;
  /** A raised deck at the back of the hall, reached by a ramp */
  mezzanine?: boolean;
  /** Style of the ring's core walls (glass by default) */
  core?: WallStyle;
};

export const DOOR = 1.8;

function split(from: number, to: number, n: number) {
  const step = (to - from) / n;
  return Array.from({ length: n }, (_, i) => [from + i * step, from + (i + 1) * step] as const);
}

const rect = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 });

export function makePlan(cut: Cut, size: [number, number, number], rooms: number, o: CutOptions = {}): Plan {
  const [W, D, H] = size;
  const style = o.style ?? "solid";
  const out: Plan = { W, D, H, hall: rect(-W / 2, W / 2, -D / 2, D / 2), hero: [0, -D * 0.12], rooms: [], walls: [], platforms: [] };
  const walls = out.walls;
  const add = (r: Rect, door: Side, open = false) => out.rooms.push({ ...r, slot: out.rooms.length, door, open });

  switch (cut) {
    case "atrium": {
      const hw = W * (o.hall ?? 0.44);
      const left = Math.ceil(rooms / 2);
      const right = rooms - left;
      for (const [side, count] of [
        [-1, left],
        [1, right],
      ] as const) {
        if (!count) continue;
        const x0 = side < 0 ? -W / 2 : hw / 2;
        const x1 = side < 0 ? -hw / 2 : W / 2;
        const bands = split(-D / 2, D / 2, count);
        bands.forEach(([z0, z1], i) => {
          add(rect(x0, x1, z0, z1), side < 0 ? "e" : "w");
          if (i > 0) walls.push({ axis: "x", at: z0, from: x0, to: x1, doors: [], style });
        });
        walls.push({ axis: "z", at: side * (hw / 2), from: -D / 2, to: D / 2, doors: bands.map(([a, b]) => (a + b) / 2), style });
      }
      out.hall = rect(-hw / 2, right ? hw / 2 : W / 2, -D / 2, D / 2);
      out.hero = [out.hall.x, -D * 0.1];
      break;
    }
    case "corridor": {
      // Lobby band at the front, a spine to the great hall at the back, and on each side of the spine
      // an inner room (door onto the spine) and, when there are enough rooms, an outer room (door onto
      // the lobby band).
      const L = o.front ?? 5;
      const B = o.back ?? D * 0.42;
      const cw = o.spine ?? 4.4;
      const zb = -D / 2 + B;
      const zf = D / 2 - L;
      const left = Math.ceil(rooms / 2);
      const right = rooms - left;
      for (const [side, count] of [
        [-1, left],
        [1, right],
      ] as const) {
        const inner = side * (cw / 2);
        const outer = side * (W / 2);
        const lo = Math.min(inner, outer);
        const hi = Math.max(inner, outer);
        walls.push({ axis: "x", at: zb, from: lo, to: hi, doors: [], style });
        if (count >= 2) {
          const mid = inner + side * ((W - cw) / 2) * 0.48;
          add(rect(Math.min(inner, mid), Math.max(inner, mid), zb, zf), side < 0 ? "e" : "w");
          add(rect(Math.min(mid, outer), Math.max(mid, outer), zb, zf), "s");
          walls.push({ axis: "z", at: mid, from: zb, to: zf, doors: [], style });
          walls.push({ axis: "x", at: zf, from: lo, to: hi, doors: [(mid + outer) / 2], style });
          walls.push({ axis: "z", at: inner, from: zb, to: zf, doors: [(zb + zf) / 2], style });
        } else if (count === 1) {
          add(rect(lo, hi, zb, zf), side < 0 ? "e" : "w");
          walls.push({ axis: "x", at: zf, from: lo, to: hi, doors: [], style });
          walls.push({ axis: "z", at: inner, from: zb, to: zf, doors: [(zb + zf) / 2], style });
        }
      }
      out.hall = rect(-W / 2, W / 2, -D / 2, zb);
      out.hero = [0, -D / 2 + B * 0.48];
      break;
    }
    case "loft": {
      const bd = o.back ?? 6;
      const backRooms = Math.min(rooms, rooms >= 4 ? 2 : rooms >= 2 ? 1 : rooms);
      const sideRooms = rooms - backRooms;
      const zw = Math.min(6, W * 0.22);
      // Glass rooms across the back (centered, leaving the corners to the side zones when there are any).
      const bx0 = sideRooms ? -W / 2 + zw : -W / 2;
      const bx1 = sideRooms > 1 ? W / 2 - zw : W / 2;
      const bands = split(bx0, bx1, backRooms);
      bands.forEach(([x0, x1], i) => {
        add(rect(x0, x1, -D / 2, -D / 2 + bd), "s");
        if (i > 0) walls.push({ axis: "z", at: x0, from: -D / 2, to: -D / 2 + bd, doors: [], style: o.style ?? "glass" });
      });
      walls.push({ axis: "x", at: -D / 2 + bd, from: bx0, to: bx1, doors: bands.map(([a, b]) => (a + b) / 2), style: o.style ?? "glass" });
      if (bx0 > -W / 2) walls.push({ axis: "z", at: bx0, from: -D / 2, to: -D / 2 + bd, doors: [], style: o.style ?? "glass" });
      if (bx1 < W / 2) walls.push({ axis: "z", at: bx1, from: -D / 2, to: -D / 2 + bd, doors: [], style: o.style ?? "glass" });
      // Open zones along the side walls: left takes the 1st and 3rd, right the 2nd and 4th.
      const zTop = -D / 2;
      const zBottom = D / 2 - 5.5;
      for (let i = 0; i < sideRooms; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const onSide = Math.ceil((sideRooms - (side < 0 ? 0 : 1)) / 2);
        const row = Math.floor(i / 2);
        const [z0, z1] = split(zTop, zBottom, onSide)[row];
        add(rect(side < 0 ? -W / 2 : W / 2 - zw, side < 0 ? -W / 2 + zw : W / 2, z0, z1), side < 0 ? "e" : "w", true);
      }
      out.hall = rect(sideRooms ? -W / 2 + zw : -W / 2, sideRooms > 1 ? W / 2 - zw : W / 2, -D / 2 + bd, D / 2);
      out.hero = [out.hall.x, -D / 2 + bd + (D - bd) * 0.36];
      break;
    }
    case "enfilade": {
      const F = o.front ?? Math.max(11, D * 0.5);
      const z = D / 2 - F;
      const bands = split(-W / 2, W / 2, rooms);
      bands.forEach(([x0, x1], i) => {
        add(rect(x0, x1, -D / 2, z), "s");
        if (i > 0) walls.push({ axis: "z", at: x0, from: -D / 2, to: z, doors: [(-D / 2 + z) / 2], style });
      });
      walls.push({ axis: "x", at: z, from: -W / 2, to: W / 2, doors: bands.map(([a, b]) => (a + b) / 2), style });
      out.hall = rect(-W / 2, W / 2, z, D / 2);
      out.hero = [0, Math.min(z + (F - 4) * 0.45, D / 2 - 8)];
      break;
    }
    case "ring": {
      const cw = W * (o.hall ?? 0.38);
      const cd = D * 0.42;
      const cz = -D * 0.08;
      const [x0, x1, z0, z1] = [-cw / 2, cw / 2, cz - cd / 2, cz + cd / 2];
      // The core is glass by default, so the centerpiece shows from the entrance.
      const core = o.core ?? "glass";
      walls.push({ axis: "x", at: z1, from: x0, to: x1, doors: [0], style: core });
      walls.push({ axis: "x", at: z0, from: x0, to: x1, doors: [], style: core });
      walls.push({ axis: "z", at: x0, from: z0, to: z1, doors: [cz], style: core });
      walls.push({ axis: "z", at: x1, from: z0, to: z1, doors: [cz], style: core });
      // Corner rooms, back ones first.
      const rw = (W - cw) / 2 - 2.8;
      const rd = Math.min(D * 0.3, 7.5);
      const corners: [number, number, Side][] = [
        [-1, -1, "s"],
        [1, -1, "s"],
        [-1, 1, "n"],
        [1, 1, "n"],
      ];
      corners.slice(0, rooms).forEach(([sx, sz]) => {
        const rx0 = sx < 0 ? -W / 2 : W / 2 - rw;
        const rx1 = sx < 0 ? -W / 2 + rw : W / 2;
        const rz0 = sz < 0 ? -D / 2 : D / 2 - rd;
        const rz1 = sz < 0 ? -D / 2 + rd : D / 2;
        add(rect(rx0, rx1, rz0, rz1), sz < 0 ? "s" : "n");
        walls.push({ axis: "x", at: sz < 0 ? rz1 : rz0, from: rx0, to: rx1, doors: [(rx0 + rx1) / 2], style });
        walls.push({ axis: "z", at: sx < 0 ? rx1 : rx0, from: rz0, to: rz1, doors: [], style });
      });
      out.hall = rect(x0, x1, z0, z1);
      out.hero = [0, cz];
      break;
    }
    case "nested": {
      // Margin band (open zones), the border wall, the padding band, the content core.
      const m = 4.2;
      const p = 3.6;
      const front = 6;
      const b = { x0: -W / 2 + m, x1: W / 2 - m, z0: -D / 2 + m, z1: D / 2 - front };
      const c = { x0: b.x0 + p, x1: b.x1 - p, z0: b.z0 + p, z1: b.z1 - p };
      const door1 = -W * 0.16;
      const door2 = W * 0.14;
      walls.push({ axis: "x", at: b.z1, from: b.x0, to: b.x1, doors: [door1], style: "solid" });
      walls.push({ axis: "x", at: b.z0, from: b.x0, to: b.x1, doors: [], style: "solid" });
      walls.push({ axis: "z", at: b.x0, from: b.z0, to: b.z1, doors: [], style: "solid" });
      walls.push({ axis: "z", at: b.x1, from: b.z0, to: b.z1, doors: [], style: "solid" });
      walls.push({ axis: "x", at: c.z1, from: c.x0, to: c.x1, doors: [], style: o.style ?? "glass" });
      walls.push({ axis: "x", at: c.z0, from: c.x0, to: c.x1, doors: [door2], style: o.style ?? "glass" });
      walls.push({ axis: "z", at: c.x0, from: c.z0, to: c.z1, doors: [], style: o.style ?? "glass" });
      walls.push({ axis: "z", at: c.x1, from: c.z0, to: c.z1, doors: [], style: o.style ?? "glass" });
      const zones: [Rect, Side][] = [
        [rect(-W / 2, b.x0, -D / 2 + 1, D / 2 - front), "e"],
        [rect(b.x1, W / 2, -D / 2 + 1, D / 2 - front), "w"],
        [rect(c.x0, c.x1, b.z0, c.z0), "s"],
        [rect(b.x0, c.x0, b.z0 + 1, b.z1 - 1), "e"],
      ];
      zones.slice(0, rooms).forEach(([r, side]) => add(r, side, true));
      out.hall = rect(c.x0, c.x1, c.z0, c.z1);
      out.hero = [0, (c.z0 + c.z1) / 2];
      break;
    }
    case "warehouse": {
      const ow = o.spine ?? 6;
      const s = o.mirror ? 1 : -1;
      const xw = s * (W / 2 - ow);
      const bands = split(-D / 2, D / 2 - 6, rooms);
      bands.forEach(([z0, z1], i) => {
        add(rect(s < 0 ? -W / 2 : xw, s < 0 ? xw : W / 2, z0, z1), s < 0 ? "e" : "w");
        if (i > 0) walls.push({ axis: "x", at: z0, from: Math.min(xw, s * W / 2), to: Math.max(xw, s * W / 2), doors: [], style });
      });
      walls.push({ axis: "z", at: xw, from: -D / 2, to: D / 2 - 6, doors: bands.map(([a, b]) => (a + b) / 2), style });
      walls.push({ axis: "x", at: D / 2 - 6, from: Math.min(xw, s * W / 2), to: Math.max(xw, s * W / 2), doors: [], style });
      out.hall = s < 0 ? rect(xw, W / 2, -D / 2, D / 2) : rect(-W / 2, xw, -D / 2, D / 2);
      out.hero = [out.hall.x, -D * 0.1];
      break;
    }
  }

  if (o.mirror && cut !== "warehouse") {
    out.rooms = out.rooms.map((r) => ({ ...r, x: -r.x, door: r.door === "e" ? "w" : r.door === "w" ? "e" : r.door }));
    out.walls = out.walls.map((w) =>
      w.axis === "z" ? { ...w, at: -w.at } : { ...w, from: -w.to, to: -w.from, doors: w.doors.map((d) => -d) },
    );
    out.hall = { ...out.hall, x: -out.hall.x };
    out.hero = [-out.hero[0], out.hero[1]];
  }

  // A deck across the back of the hall, 0.9 m up, with a ramp down its middle. Only where the hall's
  // back edge is the building's back wall (no doorways there), and kept 2.2 m off the hall's sides so
  // doorways on them stay reachable.
  if (o.mezzanine && (cut === "atrium" || cut === "corridor" || cut === "warehouse")) {
    const h = out.hall;
    const depth = Math.min(4.2, h.d * 0.3);
    out.platforms.push({ x: h.x, z: h.z - h.d / 2 + depth / 2, w: h.w - 4.4, d: depth, y: 0.9, ramp: "s", rampAt: h.x });
    out.hero = [out.hero[0], Math.max(out.hero[1], h.z - h.d / 2 + depth + 5.2)];
  }
  return out;
}

/** Turns a point from a room's local frame (door at +z) into the house's frame. */
export function roomFrame(r: Rect & { door: Side }) {
  const rot = r.door === "s" ? 0 : r.door === "n" ? Math.PI : r.door === "e" ? Math.PI / 2 : -Math.PI / 2;
  const sideways = r.door === "e" || r.door === "w";
  const w = sideways ? r.d : r.w;
  const d = sideways ? r.w : r.d;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return {
    rot,
    w,
    d,
    toHouse: (x: number, z: number): [number, number] => [r.x + x * cos + z * sin, r.z - x * sin + z * cos],
  };
}
