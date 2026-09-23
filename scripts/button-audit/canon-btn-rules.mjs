// 정본 .dc.html들에서 "버튼처럼 생긴" CSS 규칙(높이 40px 이상 + border-radius)을 뽑아 규격별로 모은다.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [dir, prefix] = process.argv.slice(2);
const files = readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.dc.html'));
const pick = (body, prop) => (body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`)) || [])[1]?.trim();
const rows = [];
for (const f of files) {
  const src = readFileSync(join(dir, f), 'utf8');
  for (const m of src.matchAll(/([^{}<>]{1,160})\{([^{}]{1,700})\}/g)) {
    const sel = m[1].trim(), body = m[2];
    if (!/^[.#\w\[:\-\s,>+~*()="']+$/.test(sel)) continue;
    const h = pick(body, 'height');
    if (!h || !/^(4\d|5\d|6\d)px$/.test(h)) continue;
    if (!/border-radius/.test(body)) continue;
    rows.push({
      f: f.replace(/\.dc\.html$/, '').replace(/^[^_]+__/, ''), sel,
      h, r: pick(body, 'border-radius') || '', fs: pick(body, 'font-size') || '', fw: pick(body, 'font-weight') || '',
      bg: pick(body, 'background') || pick(body, 'background-color') || '', color: pick(body, 'color') || '',
      sh: pick(body, 'box-shadow') || '', bd: pick(body, 'border') || '', pad: pick(body, 'padding') || '',
    });
  }
}
// 같은 규칙(선택자+본문)이 여러 파일에 반복되면 한 번만
const uniq = new Map();
for (const r of rows) { const k = r.sel + '|' + [r.h, r.r, r.fs, r.fw, r.bg, r.color, r.sh, r.bd, r.pad].join('|'); if (!uniq.has(k)) uniq.set(k, { ...r, files: [r.f] }); else uniq.get(k).files.push(r.f); }
const list = [...uniq.values()].sort((a, b) => a.h.localeCompare(b.h) || a.sel.localeCompare(b.sel));
for (const r of list) console.log(`${r.h} r${r.r} ${r.fs}/${r.fw} bg=${r.bg || '-'} c=${r.color || '-'}${r.sh ? ' sh=' + r.sh : ''}${r.bd ? ' bd=' + r.bd : ''}${r.pad ? ' pad=' + r.pad : ''}\n     ${r.sel}   [${[...new Set(r.files)].join(', ')}]`);
