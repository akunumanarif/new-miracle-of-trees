// Convert the CC0 Quaternius OBJ downloads to self-contained GLBs.
// Usage: node scripts/convert-animal-assets.mjs /path/to/extracted/packs
import { readFile, writeFile } from 'node:fs/promises';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import path from 'node:path';
import { Mesh, MeshStandardMaterial } from 'three';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};
const root = process.argv[2];
for (const [pack, names] of [
  ['Farm Animals by @Quaternius', ['Llama', 'Pig', 'Pug', 'Sheep', 'Zebra']],
  ['Animals Pack by Quaternius', ['Chick']],
]) {
  for (const name of names) {
    const dir = path.join(root, pack, 'OBJ');
    const materials = new MTLLoader().parse(await readFile(path.join(dir, `${name}.mtl`), 'utf8'), '');
    const model = new OBJLoader().setMaterials(materials).parse(await readFile(path.join(dir, `${name}.obj`), 'utf8'));
    model.traverse(child => {
      if (!(child instanceof Mesh)) return;
      const convert = material => {
        const next = new MeshStandardMaterial({ color: material.color, roughness: 1, metalness: 0, flatShading: true });
        next.name = material.name;
        if (name === 'Chick') next.color.set(material.name === 'Material.001' ? '#f5d66e' : '#da9850');
        return next;
      };
      child.material = Array.isArray(child.material) ? child.material.map(convert) : convert(child.material);
    });
    const glb = await new GLTFExporter().parseAsync(model, { binary: true });
    await writeFile(`public/dunia-hewan/models/${name}.glb`, Buffer.from(glb));
    console.log(`${name}: ${glb.byteLength} bytes`);
  }
}
