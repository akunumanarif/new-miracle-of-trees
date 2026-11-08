import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer, Box3, Vector3 } from 'three';

// Decode embedded textures without needing a GPU; exercise the actual GLTFLoader,
// skeletons and idle clips, and verify all page references resolve offline.
globalThis.self = globalThis;
globalThis.createImageBitmap = async blob => {
  const { width, height } = await sharp(Buffer.from(await blob.arrayBuffer())).metadata();
  assert(width && height, 'Embedded texture must decode');
  return { width, height, close() {} };
};
const source = await readFile('components/dunia-hewan/animals.ts', 'utf8');
const models = [...source.matchAll(/model: "([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(models).size, models.length, 'Every animal has its own model');
let bytes = 0;
for (const name of models) {
  const data = await readFile(`public/dunia-hewan/models/${name}.glb`);
  assert.equal(data.readUInt32LE(0), 0x46546c67, `${name} must be a GLB, not an HTML error or LFS pointer`);
  assert.equal(data.readUInt32LE(8), data.length, `${name} length`);
  const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  assert(!json.buffers.some(b => b.uri), `${name} must be self contained`);
  assert(!(json.images ?? []).some(i => i.uri), `${name} textures must be embedded`);
  const model = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  const bounds = new Box3().setFromObject(model.scene).getSize(new Vector3());
  assert(bounds.toArray().every(v => Number.isFinite(v) && v > 0), `${name} has invalid geometry`);
  const idle = model.animations.find(a => /idle/i.test(a.name));
  if (idle) {
    const mixer = new AnimationMixer(model.scene);
    mixer.clipAction(idle).play(); mixer.update(.5);
    const posed = new Box3().setFromObject(model.scene).getSize(new Vector3());
    assert(posed.toArray().every(v => Number.isFinite(v) && v > 0), `${name} has invalid animation`);
    mixer.stopAllAction(); mixer.uncacheRoot(model.scene);
  }
  bytes += data.length;
}
const audio = [...new Set([...source.matchAll(/audio: "([^"]+)"/g)].map(m => `${m[1]}.mp3`))];
audio.push('ambience-forest-49.mp3');
for (const name of audio) {
  const data = await readFile(`public/dunia-hewan/audio/${name}`);
  assert(data.length > 1000 && (data.subarray(0, 3).toString() === 'ID3' || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0)), `${name} must be MPEG audio`);
}
const pages = ['app/page.tsx', 'components/storefront.tsx'];
for (const page of pages) assert(!(await readFile(page, 'utf8')).includes('/dunia-hewan'), 'The front page must not link to this route yet');
assert.equal((await readdir('public/dunia-hewan/models')).filter(n => n.endsWith('.glb')).length, models.length, 'No unreferenced models');
console.log(`PASS: ${models.length} models decoded, idle animations valid, ${audio.length} audio references valid, no front-page link. Models: ${(bytes / 1024 / 1024).toFixed(2)} MiB.`);
