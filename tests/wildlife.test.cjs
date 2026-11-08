const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(name) {
  const exports = {};
  const source = readFileSync(resolve(__dirname, '../components/dunia-hewan', name + '.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports });
  return exports;
}
const { ANIMALS } = load('animals');
const { Wildlife, airborne, inLake, GRAZERS, PREDATORS } = load('wildlife');

test('all NPCs move, birds land safely, grazers eat, and predators play during three simulated minutes', () => {
  const world = new Wildlife(ANIMALS);
  const seen = new Map(ANIMALS.map(a => [a.id, new Set()]));
  const distance = new Map(ANIMALS.map(a => [a.id, 0]));
  for (let frame = 0; frame < 180 * 30; frame++) {
    const previous = new Map([...world.agents].map(([id, a]) => [id, [...a.position]]));
    world.update(1 / 30);
    for (const [id, a] of world.agents) {
      seen.get(id).add(a.behavior);
      assert(a.position.every(Number.isFinite), id + ': finite coordinates');
      assert(Math.hypot(a.position[0], a.position[2]) <= 31.001, id + ': world boundary');
      const old = previous.get(id);
      const step = Math.hypot(a.position[0] - old[0], a.position[2] - old[2]);
      assert(step < .1, id + ': no horizontal teleport');
      distance.set(id, distance.get(id) + step);
      if (!airborne(a.behavior) && a.behavior !== 'swim') {
        assert(!inLake(a.position[0], a.position[2], -.1), id + ': landed on solid ground');
        assert(Math.abs(a.position[1]) < .01, id + ': feet reach ground');
      }
      if (a.behavior === 'swim') assert(inLake(a.position[0], a.position[2]), id + ': swims inside lake');
    }
  }
  for (const [id, modes] of seen) {
    assert(distance.get(id) > 3, id + ': moved independently');
    if (GRAZERS.has(id)) assert(modes.has('graze'), id + ': grazing');
    if (PREDATORS.has(id)) {
      assert(!modes.has('graze'), id + ': species-appropriate food behavior');
      assert(modes.has('spar'), id + ': interaction cycle');
    }
    if (['parrot', 'flamingo', 'stork', 'duck', 'goose', 'chick'].includes(id)) {
      for (const mode of ['takeoff', 'fly', 'land']) assert(modes.has(mode), id + ': ' + mode);
    }
  }
  assert(seen.get('chick').has('peck'));
  assert(seen.get('chick').has('run'));
});

test('pause freezes the complete simulation and resuming does not jump ahead', () => {
  const world = new Wildlife(ANIMALS);
  world.update(.1);
  const before = JSON.stringify([...world.agents]);
  const time = world.time;
  for (let i = 0; i < 200; i++) world.update(1, false, true);
  assert.equal(world.time, time);
  assert.equal(JSON.stringify([...world.agents]), before);
  world.update(1 / 30);
  assert(world.time - time < .04);
});

test('fixed simulation steps behave consistently at 30 and 60 fps; night allows resting', () => {
  const a = new Wildlife(ANIMALS), b = new Wildlife(ANIMALS);
  for (let i = 0; i < 900; i++) a.update(1 / 30);
  for (let i = 0; i < 1800; i++) b.update(1 / 60);
  assert.equal(JSON.stringify([...a.agents]), JSON.stringify([...b.agents]));
  const night = new Wildlife(ANIMALS);
  for (let i = 0; i < 30 * 20; i++) night.update(1 / 30, true);
  assert.equal(night.agents.get('cow').behavior, 'rest');
  assert.notEqual(night.agents.get('wolf').behavior, 'rest');
});
