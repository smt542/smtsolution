// origin/app 스크린샷 오버레이 diff + 불일치 비율 리포트
// usage: node scripts/pixel-diff/diff.mjs <id|all>
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');

async function load(p) {
  return PNG.sync.read(await readFile(p));
}

const idArg = process.argv[2] || 'all';
const ids =
  idArg === 'all'
    ? (await readdir(path.join(OUT, 'origin')))
        .filter((f) => f.endsWith('.png'))
        .map((f) => f.replace('.png', ''))
    : [idArg];

await mkdir(path.join(OUT, 'diff'), { recursive: true });
let worst = 0;
for (const id of ids) {
  const a = await load(path.join(OUT, 'origin', `${id}.png`));
  const b = await load(path.join(OUT, 'app', `${id}.png`));
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const crop = (img) => {
    if (img.width === w && img.height === h) return img;
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(img, out, 0, 0, w, h, 0, 0);
    return out;
  };
  const ca = crop(a);
  const cb = crop(b);
  const diff = new PNG({ width: w, height: h });
  const mismatch = pixelmatch(ca.data, cb.data, diff.data, w, h, { threshold: 0.1 });
  await writeFile(path.join(OUT, 'diff', `${id}.png`), PNG.sync.write(diff));
  const pct = (mismatch / (w * h)) * 100;
  worst = Math.max(worst, pct);
  const sizeFlag =
    a.width !== b.width || a.height !== b.height
      ? ` [size origin ${a.width}x${a.height} vs app ${b.width}x${b.height}]`
      : '';
  console.log(`${id}: ${pct.toFixed(3)}%  (${mismatch}px / ${w}x${h})${sizeFlag}`);
}
console.log(`worst: ${worst.toFixed(3)}%`);
