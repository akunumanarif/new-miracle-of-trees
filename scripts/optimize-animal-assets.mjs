// Keep just the peaceful idle animation used by the learning page.
// Downloads are CC0; this exports a smaller, self-contained derivative GLB.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};
const dir = 'public/dunia-hewan/models';
for (const name of await readdir(dir)) {
  if (!name.endsWith('.glb') || name[0] === name[0].toUpperCase()) continue;
  const bytes = await readFile(`${dir}/${name}`);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const idle = gltf.animations.find(a => a.name === 'Idle');
  const output = await new GLTFExporter().parseAsync(gltf.scene, { binary: true, animations: idle ? [idle] : [] });
  await writeFile(`${dir}/${name}`, Buffer.from(output));
  console.log(`${name}: ${bytes.byteLength} → ${output.byteLength}`);
}
