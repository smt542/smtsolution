// Generate distinct, valid PNG fixtures for notice body-image E2E.
// usage: node scripts/notice-e2e/make-fixtures.mjs
import { PNG } from 'pngjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'fixtures');
await mkdir(OUT, { recursive: true });

function makePng(w, h, rgb, stripe) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (w * y + x) << 2;
      // base color
      let [r, g, b] = rgb;
      // diagonal white stripe so each image is visually distinct in screenshots
      if (stripe && Math.abs(((x + y) % 120) - 60) < 8) { r = 255; g = 255; b = 255; }
      png.data[idx] = r; png.data[idx + 1] = g; png.data[idx + 2] = b; png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

await writeFile(path.join(OUT, 'e2e-img-a.png'), makePng(480, 320, [214, 40, 40], true));   // red
await writeFile(path.join(OUT, 'e2e-img-b.png'), makePng(480, 320, [20, 80, 200], true));    // blue

// >10MB noise PNG to exercise the size-limit rejection (noise defeats deflate)
function makeNoisePng(w, h) {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < png.data.length; i++) png.data[i] = (Math.random() * 256) | 0;
  // force full opacity so it stays a valid opaque image
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
  return PNG.sync.write(png);
}
await writeFile(path.join(OUT, 'e2e-img-huge.png'), makeNoisePng(1900, 1900)); // ~14MB raw → >10MB compressed

// invalid MIME (bucket allows gif, but the notice client policy is jpeg/png/webp only)
const gif = Buffer.from(
  '47494638396101000100800000000000ffffff21f904000000002c00000000010001000002024401003b',
  'hex',
);
await writeFile(path.join(OUT, 'e2e-not-allowed.gif'), gif);
console.log('fixtures written to', OUT);
