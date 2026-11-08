// Restore the useful CC0 animal clips; leave death and weapon clips out.
// Usage: node scripts/prepare-wildlife-animations.mjs /path/to/raw/glbs /path/to/farm-pack
import { readFile, writeFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { AnimationClip, Mesh, MeshStandardMaterial } from 'three';
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};
const raw = process.argv[2], farm = process.argv[3];
const keep = /^(Idle|Idle_2|Eating|Walk|Gallop|Attack|Jump_ToIdle)$/;
for (const name of ['alpaca', 'bull', 'cow', 'deer', 'donkey', 'fox', 'horse', 'husky', 'shibainu', 'stag', 'wolf']) {
  const data = await readFile(`${raw}/${name}.glb`);
  const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  const clips = gltf.animations.filter(a => keep.test(a.name));
  const output = await new GLTFExporter().parseAsync(gltf.scene, { binary: true, animations: clips });
  await writeFile(`public/dunia-hewan/models/${name}.glb`, Buffer.from(output));
  console.log(name, clips.map(c => c.name).join(', '));
}
const loadFarm = async name => {
  const bytes = await readFile(`${farm}/FBX/${name}.fbx`);
  return new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
};
const zebra = await loadFarm('Zebra');
for (const name of ['Llama', 'Pig', 'Pug', 'Sheep', 'Zebra']) {
  const model = name === 'Zebra' ? zebra : await loadFarm(name);
  const names = new Set(); model.traverse(n => names.add(n.name));
  const clips = model.animations.filter(a => /Idle|Walk|Run|Jump/.test(a.name));
  if (name !== 'Zebra') {
    // This older farm pack shares a skeleton. Rotations transfer between the
    // animals; translations are deliberately excluded to preserve leg lengths.
    for (const label of ['Walk', 'Run']) {
      const template = zebra.animations.find(a => a.name === `Armature|${label}`);
      const tracks = template.tracks.filter(t => t.name.endsWith('.quaternion') && names.has(t.name.slice(0, -11))).map(t => t.clone());
      clips.push(new AnimationClip(label, template.duration, tracks));
    }
  }
  model.traverse(child => {
    if (!(child instanceof Mesh)) return;
    const convert = m => new MeshStandardMaterial({ color: m.color, roughness: 1, flatShading: true });
    child.material = Array.isArray(child.material) ? child.material.map(convert) : convert(child.material);
  });
  const output = await new GLTFExporter().parseAsync(model, { binary: true, animations: clips });
  await writeFile(`public/dunia-hewan/models/${name}.glb`, Buffer.from(output));
  console.log(name, clips.map(c => c.name).join(', '));
}
