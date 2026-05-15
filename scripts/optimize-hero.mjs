import sharp from 'sharp';
import { readdirSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const SRC = 'images/hero/raw';
const OUT = 'images/hero';
const THUMB_W = 200;
const THUMB_H = 68;
const MAIN_W = 600;
const MAIN_H = 230;

if (!existsSync(SRC)) {
  console.error('Dossier images/hero/raw absent — place les images Higgsfield dedans');
  process.exit(1);
}

const files = readdirSync(SRC).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
console.log(`Traitement de ${files.length} image(s)...`);

for (const file of files) {
  const src = join(SRC, file);
  const name = basename(file, extname(file));
  const img = sharp(src);

  // Main WebP 600×230
  await img.clone().resize(MAIN_W, MAIN_H, { fit: 'cover', position: 'center' })
    .webp({ quality: 82 })
    .toFile(join(OUT, `${name}.webp`));

  // Main AVIF 600×230
  await img.clone().resize(MAIN_W, MAIN_H, { fit: 'cover', position: 'center' })
    .avif({ quality: 65 })
    .toFile(join(OUT, `${name}.avif`));

  // JPG fallback 600×230
  await img.clone().resize(MAIN_W, MAIN_H, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(join(OUT, `${name}.jpg`));

  // Thumbnail WebP 200×68
  await img.clone().resize(THUMB_W, THUMB_H, { fit: 'cover', position: 'center' })
    .webp({ quality: 75 })
    .toFile(join(OUT, `${name}-thumb.webp`));

  console.log(`✓ ${name} → WebP + AVIF + JPG + thumb`);
}

console.log('Optimisation terminée.');
