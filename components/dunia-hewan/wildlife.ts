import type { Animal } from "./animals";

export type Behavior = "idle" | "walk" | "graze" | "sniff" | "run" | "chase" | "flee" | "spar" | "takeoff" | "fly" | "land" | "swim" | "peck" | "rest";
export type Point = [number, number, number];
export type Agent = {
  animal: Animal; position: Point; target: Point; home: Point; heading: number;
  behavior: Behavior; age: number; duration: number; speed: number; gait: number;
  flight: number; bank: number; seed: number; visits: number; previousHeading: number;
};

export const BIRDS = new Set(["parrot", "flamingo", "stork", "duck", "goose", "chick"]);
export const WATERFOWL = new Set(["duck", "goose"]);
export const GRAZERS = new Set(["deer", "stag", "cow", "bull", "horse", "donkey", "alpaca", "llama", "sheep", "zebra", "elephant", "bunny"]);
export const PREDATORS = new Set(["fox", "wolf", "lion", "tiger", "bear"]);
export const moving = (mode: Behavior) => ["walk", "run", "chase", "flee", "swim", "takeoff", "fly", "land"].includes(mode);
export const airborne = (mode: Behavior) => ["takeoff", "fly", "land"].includes(mode);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const TAU = Math.PI * 2;
export const seeded = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

export function makeTrees(animals: readonly Animal[]) {
  return Array.from({ length: 95 }, (_, i) => {
    const x = seeded(i + 1) * 60 - 30, z = seeded(i + 150) * 56 - 30;
    const nearAnimal = animals.some(a => Math.hypot(a.position[0] - x, a.position[2] - z) < 3.4);
    const nearLake = Math.hypot((x - 15) / 1.2, z + 2) < 10;
    return { x, z, size: .7 + seeded(i + 90) * .65, variant: i, show: !nearAnimal && !nearLake && Math.hypot(x, z) < 33 && (x < -3 || z < -12 || Math.abs(x) > 24) };
  }).filter(t => t.show);
}

export function inLake(x: number, z: number, margin = 0) {
  return Math.hypot((x - 15) / 1.13, z + 3) < 7 + margin;
}

// Broad phase of the curved stream used by the landscape; ground NPCs keep to
// the banks, while birds can cross overhead and waterfowl use the central lake.
function inStream(x: number, z: number) {
  const points = [[13, -30], [10, -17], [15, -8], [15, 0], [23, 9], [30, 17]];
  return points.slice(1).some((p, i) => {
    const a = points[i], dx = p[0] - a[0], dz = p[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 2.25;
  });
}

export function activityLabel(a: Agent) {
  const labels: Record<Behavior, string> = {
    idle: "Melihat sekeliling", walk: "Berjalan-jalan", graze: a.animal.id === "elephant" ? "Mencari makanan" : "Merumput",
    sniff: "Mengendus tanah", run: a.animal.id === "chick" ? "Berlari kecil" : "Berlari",
    chase: "Mengejar teman", flee: "Bermain kejar-kejaran", spar: "Beradu ringan",
    takeoff: "Lepas landas", fly: a.animal.id === "chick" ? "Melompat sambil mengepak" : "Terbang berkeliling",
    land: "Mendarat", swim: "Berenang", peck: a.animal.id === "stork" ? "Mencari makan di tepian" : "Mematuk makanan", rest: "Beristirahat",
  };
  return labels[a.behavior];
}

type Encounter = { a: Agent; b: Agent; center: Point; age: number; stage: "chase" | "spar" };

export class Wildlife {
  readonly agents = new Map<string, Agent>();
  readonly trees: ReturnType<typeof makeTrees>;
  time = 0;
  private accumulator = 0;
  private encounter: Encounter | null = null;
  private nextEncounter = 7;
  private encounterIndex = 0;

  constructor(animals: readonly Animal[]) {
    this.trees = makeTrees(animals);
    animals.forEach((animal, i) => {
      const home: Point = [...animal.position];
      home[1] = 0;
      if (animal.id === "flamingo") { home[0] = 9; home[2] = -10; }
      if (animal.id === "stork") { home[0] = 22; home[2] = -8; }
      const behavior: Behavior = animal.flying && !WATERFOWL.has(animal.id) ? "fly" : WATERFOWL.has(animal.id) ? "swim" : animal.id === "chick" ? "run" : GRAZERS.has(animal.id) && i % 2 === 0 ? "graze" : "walk";
      const a: Agent = { animal, position: [...animal.position], home, target: [...home], heading: seeded(i + 70) * TAU, previousHeading: 0,
        behavior, age: 0, duration: 4 + seeded(i + 44) * 8, speed: 0, gait: seeded(i + 31) * TAU,
        flight: airborne(behavior) ? 1 : 0, bank: 0, seed: (i + 1) * 1859, visits: 0 };
      if (behavior === "swim") a.position[1] = -.2;
      this.agents.set(animal.id, a);
      this.chooseTarget(a, behavior === "fly" ? 7 : 4);
    });
  }

  private random(a: Agent) { a.seed = (Math.imul(a.seed, 1664525) + 1013904223) >>> 0; return a.seed / 4294967296; }

  walkable(x: number, z: number, radius = .5) {
    if (Math.hypot(x, z) > 31 - radius || inLake(x, z, radius) || inStream(x, z)) return false;
    return !this.trees.some(t => Math.hypot(t.x - x, t.z - z) < .7 * t.size + radius);
  }

  private chooseTarget(a: Agent, radius = 5) {
    for (let i = 0; i < 36; i++) {
      const angle = this.random(a) * TAU, r = 1.5 + this.random(a) * radius;
      const x = a.home[0] + Math.cos(angle) * r, z = a.home[2] + Math.sin(angle) * r;
      if (Math.hypot(x, z) > 30) continue;
      if (a.behavior === "swim" ? inLake(x, z, -1) : (airborne(a.behavior) && a.animal.id !== "chick") || this.walkable(x, z, Math.min(.8, a.animal.size * .2))) {
        a.target = [x, 0, z]; return;
      }
    }
    a.target = [...a.home];
  }

  private enter(a: Agent, behavior: Behavior, duration: number) {
    a.behavior = behavior; a.age = 0; a.duration = duration;
    if (moving(behavior)) this.chooseTarget(a, behavior === "fly" ? 7 : 5);
  }

  private next(a: Agent, night: boolean) {
    const id = a.animal.id;
    a.visits++;
    if (night && !["wolf", "fox"].includes(id) && !airborne(a.behavior)) { this.enter(a, "rest", 8 + this.random(a) * 7); return; }
    if (BIRDS.has(id)) {
      if (a.behavior === "takeoff") { this.enter(a, "fly", id === "chick" ? 1.1 : 10 + this.random(a) * 7); return; }
      if (a.behavior === "fly") {
        const landing: Point = id === "chick" ? [...a.position] : WATERFOWL.has(id) ? id === "goose" ? [18, 0, -1] : [16, 0, -5] : [...a.home];
        landing[1] = 0;
        this.enter(a, "land", id === "chick" ? .65 : Math.max(2.8, Math.hypot(landing[0] - a.position[0], landing[2] - a.position[2]) / 2.5 + .4));
        a.target = landing; return;
      }
      if (a.behavior === "land") { this.enter(a, WATERFOWL.has(id) ? "swim" : "peck", 4 + this.random(a) * 3); return; }
      if (id === "chick") {
        if (a.behavior === "run") { this.enter(a, "peck", 2.5); return; }
        if (a.visits % 3 === 2) { this.enter(a, "takeoff", .45); return; }
        this.enter(a, "run", 3 + this.random(a) * 3); return;
      }
      if (WATERFOWL.has(id) && a.behavior === "swim" && a.visits % 3 !== 0) { this.enter(a, "swim", 5 + this.random(a) * 4); return; }
      if (a.behavior === "walk") { this.enter(a, "takeoff", 2); return; }
      if (a.behavior === "peck") { this.enter(a, "walk", 4); return; }
      this.enter(a, "takeoff", 2); return;
    }
    if (["walk", "run"].includes(a.behavior)) {
      this.enter(a, GRAZERS.has(id) ? "graze" : PREDATORS.has(id) ? "idle" : "sniff", 3 + this.random(a) * 5);
    } else {
      this.enter(a, ["husky", "shiba", "pug", "bunny"].includes(id) && this.random(a) > .6 ? "run" : "walk", 4 + this.random(a) * 5);
    }
  }

  private startEncounter() {
    const pairs = [["lion", "tiger"], ["bear", "wolf"], ["fox", "shiba"]];
    const [idA, idB] = pairs[this.encounterIndex++ % pairs.length];
    const a = this.agents.get(idA), b = this.agents.get(idB);
    if (!a || !b) { this.nextEncounter = this.time + 12; return; }
    const center: Point = [(a.position[0] + b.position[0]) / 2, 0, (a.position[2] + b.position[2]) / 2];
    this.encounter = { a, b, center, age: 0, stage: "chase" };
    this.enter(a, "chase", 6); this.enter(b, "flee", 6);
  }

  private encounters(dt: number, night: boolean) {
    if (!this.encounter && this.time >= this.nextEncounter && !night) this.startEncounter();
    const e = this.encounter;
    if (!e) return;
    e.age += dt;
    if (e.stage === "chase") {
      const angle = e.age * .8;
      e.b.target = [e.center[0] + Math.cos(angle) * 4, 0, e.center[2] + Math.sin(angle) * 3];
      e.a.target = [...e.b.position];
      if (e.age > 6 && (Math.hypot(e.a.position[0] - e.b.position[0], e.a.position[2] - e.b.position[2]) < 3.5 || e.age > 12)) { e.stage = "spar"; e.age = 0; this.enter(e.a, "spar", 4); this.enter(e.b, "spar", 4); }
    } else {
      const gap = (e.a.animal.size + e.b.animal.size) * .45;
      e.a.target = [e.center[0] - gap / 2, 0, e.center[2]];
      e.b.target = [e.center[0] + gap / 2, 0, e.center[2]];
      if (e.age > 4) {
        this.enter(e.a, "walk", 7); this.enter(e.b, "walk", 7);
        e.a.target = [...e.a.home]; e.b.target = [...e.b.home];
        this.encounter = null; this.nextEncounter = this.time + 12;
      }
    }
  }

  update(delta: number, night = false, paused = false) {
    if (paused) return;
    this.accumulator += clamp(delta, 0, .12);
    while (this.accumulator >= 1 / 30) { this.step(1 / 30, night); this.accumulator -= 1 / 30; }
  }

  private step(dt: number, night: boolean) {
    this.time += dt;
    this.encounters(dt, night);
    for (const a of this.agents.values()) {
      a.age += dt;
      if (a.age >= a.duration && !["chase", "flee", "spar"].includes(a.behavior)) this.next(a, night);
      const id = a.animal.id;
      const air = airborne(a.behavior);
      const targetFlight = a.behavior === "takeoff" ? clamp(a.age / a.duration, 0, 1) : a.behavior === "land" ? 1 - clamp(a.age / a.duration, 0, 1) : a.behavior === "fly" ? 1 : 0;
      a.flight = targetFlight * targetFlight * (3 - 2 * targetFlight);
      const height = id === "chick" ? .65 : id === "parrot" ? 5.5 : 6.2;
      a.position[1] = a.flight * (height + Math.sin(this.time * 1.5 + a.seed) * .13) - (a.behavior === "swim" ? .2 : 0);
      let speed = a.behavior === "land" ? id === "chick" ? 0 : 2.6 : a.behavior === "fly" ? id === "chick" ? 2.2 : 2.6 : ["run", "chase", "flee"].includes(a.behavior) ? id === "chick" ? 1.9 : 2.4 : a.behavior === "swim" ? .6 : moving(a.behavior) ? .65 : a.behavior === "spar" ? 1.1 : 0;
      if (id === "elephant") speed *= .65;
      let dx = a.target[0] - a.position[0], dz = a.target[2] - a.position[2];
      let distance = Math.hypot(dx, dz);
      if (distance < .45) {
        if (a.behavior === "land") speed = 0;
        else if (air || a.behavior === "swim") this.chooseTarget(a, id === "chick" ? 2 : 6);
        else if (a.behavior === "spar") speed = 0;
        else if (moving(a.behavior)) this.next(a, night);
        dx = a.target[0] - a.position[0]; dz = a.target[2] - a.position[2]; distance = Math.hypot(dx, dz);
      }
      let vx = distance > .01 ? dx / distance : 0, vz = distance > .01 ? dz / distance : 0;
      if (!air) {
        for (const other of this.agents.values()) {
          if (other === a || airborne(other.behavior)) continue;
          const x = a.position[0] - other.position[0], z = a.position[2] - other.position[2], d = Math.hypot(x, z);
          const safe = (a.animal.size + other.animal.size) * .25;
          if (d > .001 && d < safe) { vx += x / d * (safe - d) * 2; vz += z / d * (safe - d) * 2; }
        }
        for (const tree of a.behavior === "swim" ? [] : this.trees) {
          const x = a.position[0] - tree.x, z = a.position[2] - tree.z, d = Math.hypot(x, z), safe = tree.size + .6;
          if (d > .01 && d < safe) { vx += x / d * (safe - d) * 3; vz += z / d * (safe - d) * 3; }
        }
      }
      const norm = Math.hypot(vx, vz) || 1; vx /= norm; vz /= norm;
      const travel = Math.min(speed * dt, distance);
      const x = a.position[0] + vx * travel, z = a.position[2] + vz * travel;
      const allowed = air && id !== "chick" ? Math.hypot(x, z) < 31 : a.behavior === "swim" ? inLake(x, z, -.6) : this.walkable(x, z, Math.min(.6, a.animal.size * .16));
      if (speed > 0 && allowed) { a.position[0] = x; a.position[2] = z; }
      else if (speed > 0 && !allowed) { speed = 0; this.chooseTarget(a, 4); }
      a.speed += (speed - a.speed) * Math.min(1, dt * 8);
      if (a.speed > .04) {
        const heading = Math.atan2(vx, vz);
        const turn = Math.atan2(Math.sin(heading - a.heading), Math.cos(heading - a.heading));
        a.heading += clamp(turn, -dt * 2.7, dt * 2.7);
        a.bank += (clamp(-turn * .3, -.35, .35) * a.flight - a.bank) * dt * 5;
      } else a.bank *= .9;
      if (a.behavior === "spar" && this.encounter) {
        const other = this.encounter.a === a ? this.encounter.b : this.encounter.a;
        if (Math.hypot(a.target[0] - a.position[0], a.target[2] - a.position[2]) < .7) a.heading = Math.atan2(other.position[0] - a.position[0], other.position[2] - a.position[2]);
      }
      a.gait += dt * (a.speed > 1.3 ? 10 : a.speed > .1 ? 5 : 1.3);
      // Hard world boundary, independent of steering or large frame deltas.
      const radius = Math.hypot(a.position[0], a.position[2]);
      if (radius > 31) { a.position[0] *= 31 / radius; a.position[2] *= 31 / radius; }
    }
  }
}
