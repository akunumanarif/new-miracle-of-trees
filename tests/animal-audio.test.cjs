const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(relative, globals = {}) {
  const source = ts.transpileModule(readFileSync(resolve(__dirname, "..", relative), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, ...globals });
  return exports;
}

const { ANIMALS } = load("components/dunia-hewan/animals.ts");
const manifest = JSON.parse(readFileSync(resolve(__dirname, "../public/dunia-hewan/audio-recordings.json")));

function player(play = () => Promise.resolve()) {
  const recordings = [];
  class Audio {
    constructor(src) { this.src = src; this.currentTime = 0; this.paused = true; this.volume = 1; this.onended = null; recordings.push(this); }
    play() { this.paused = false; return play(this); }
    pause() { this.paused = true; }
  }
  const { AnimalAudio } = load("components/dunia-hewan/animal-audio.ts", {
    Audio,
    AudioContext: class { constructor() { assert.fail("Animal calls must not be synthesized"); } },
    setTimeout() { assert.fail("A shared timeout must not truncate the animal's call"); },
  });
  return { audio: new AnimalAudio(), recordings };
}

test("every animal uses a unique recording with an intact file and a source/license", () => {
  assert.equal(manifest.recordings.length, ANIMALS.length);
  const hashes = new Set();
  const filenames = new Set();
  for (const animal of ANIMALS) {
    const entry = manifest.recordings.find(e => e.id === animal.id);
    assert(entry, `${animal.id}: missing provenance`);
    assert.equal(entry.file, `${animal.audio}.mp3`);
    assert.equal(entry.description, animal.soundDescription);
    assert(!filenames.has(entry.file), `${animal.id}: reused audio file`);
    filenames.add(entry.file);
    const bytes = readFileSync(resolve(__dirname, "../public/dunia-hewan/audio", entry.file));
    const hash = createHash("sha256").update(bytes).digest("hex");
    assert.equal(hash, entry.sha256, `${animal.id}: file differs from audited recording`);
    assert(!hashes.has(hash), `${animal.id}: duplicate audio content`);
    hashes.add(hash);
    assert(entry.source.startsWith("https://"));
    assert(entry.downloadUrl.startsWith("https://"));
    assert(entry.author.length > 0);
    assert(!entry.licenseUrl.includes("by-nc"));
    assert(entry.outputDurationSeconds >= .2 && entry.outputDurationSeconds <= 12);
  }
});

test("husky, shiba and pug use recordings explicitly identified as their breed", () => {
  const sources = Object.fromEntries(manifest.recordings.map(e => [e.id, e.source]));
  assert.equal(sources.husky, "https://freesound.org/people/simcotter/sounds/115357/");
  assert.equal(sources.shiba, "https://freesound.org/people/NachtmahrTV/sounds/553188/");
  assert.equal(sources.pug, "https://freesound.org/people/RICHERlandTV/sounds/273688/");
  assert(ANIMALS.find(a => a.id === "bunny").audioLabel.includes("mengunyah"));
  assert(ANIMALS.find(a => a.id === "stork").audioLabel.includes("paruh"));
});

test("all animal buttons play their own MP3 without synthesis or a common cutoff", async () => {
  const { audio, recordings } = player();
  for (const animal of ANIMALS) {
    await audio.play(animal);
    const current = recordings.at(-1);
    assert.equal(current.src, `/dunia-hewan/audio/${animal.audio}.mp3`);
    assert.equal(current.paused, false);
    // A wolf's prepared 8.5-second howl must be allowed to finish.
    current.currentTime = 8;
    assert.equal(current.paused, false);
  }
  audio.dispose();
  assert.equal(recordings.at(-1).paused, true);
});

test("forest ambience becomes quieter during a call and returns after it ends", async () => {
  const { audio, recordings } = player();
  await audio.ambience(true);
  const forest = recordings[0];
  const normal = forest.volume;
  await audio.play(ANIMALS.find(a => a.id === "wolf"));
  assert(forest.volume < normal);
  recordings.at(-1).onended();
  assert.equal(forest.volume, normal);
  audio.dispose();
});

test("rapid selections stop the previous call without reporting its aborted play as a new error", async () => {
  let rejectFirst;
  const { audio, recordings } = player(recording => recordings.indexOf(recording) === 0
    ? new Promise((_, reject) => { rejectFirst = reject; }) : Promise.resolve());
  const first = audio.play(ANIMALS[0]);
  await audio.play(ANIMALS[1]);
  rejectFirst(new Error("play interrupted by pause"));
  await first;
  assert.equal(recordings[0].paused, true);
  assert.equal(recordings[1].paused, false);
  audio.dispose();
});

test("a failed recording reports an error instead of playing a generic substitute", async () => {
  const { audio, recordings } = player(() => Promise.reject(new Error("media decode failed")));
  await assert.rejects(audio.play(ANIMALS[0]), /media decode failed/);
  assert.equal(recordings.length, 1);
  assert.equal(recordings[0].paused, true);
});
