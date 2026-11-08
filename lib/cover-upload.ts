import "server-only";
import sharp from "sharp";
import { maxCoverBytes } from "./book-validation";

export async function prepareCover(file: File): Promise<Buffer> {
  if (file.size > maxCoverBytes) throw new Error("Ukuran gambar maksimal 5 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Gunakan gambar JPG, PNG, atau WebP.");
  }
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40000000 });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image");
    return await image.rotate().resize({ width: 1600, height: 2200, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch {
    throw new Error("Gambar tidak dapat dibaca. Pilih file JPG, PNG, atau WebP yang valid dan tidak beranimasi.");
  }
}
