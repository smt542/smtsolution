// 모바일(partner·resident) <button>의 className을 클래스맵(*Classes.ts)까지 따라가 규격을 집계한다. 읽기 전용.
// 사용법(repo 루트에서): node scripts/button-audit/mobile-btn-survey.mjs [루트경로] [-v]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const root = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : '.';
const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

// 클래스맵 파일 파싱: export const NAME = { key: "…", key2: `…`, … }
const mapCache = new Map();
function loadMaps(file) {
  if (mapCache.has(file)) return mapCache.get(file);
  const src = readFileSync(file, 'utf8');
  const maps = {};
  for (const m of src.matchAll(/export const (\w+)\s*=\s*\{([\s\S]*?)\n\}/g)) {
    const obj = {};
    for (const kv of m[2].matchAll(/(\w+)\s*:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|\[([\s\S]*?)\]\.join\(\s*["' ]*\))/g)) {
      obj[kv[1]] = (kv[2] ?? kv[3] ?? kv[4] ?? (kv[5] || '').replace(/["'`,\n]/g, ' ')).replace(/\s+/g, ' ').trim();
    }
    maps[m[1]] = obj;
  }
  mapCache.set(file, maps);
  return maps;
}

const rows = [];
for (const app of ['partner', 'resident']) {
  const base = join(root, 'app', `(${app})`);
  for (const f of walk(base).filter(p => p.endsWith('.tsx'))) {
    const t = readFileSync(f, 'utf8');
    // import { xClasses as styles } from "./xClasses"
    const alias = {};
    for (const im of t.matchAll(/import \{([^}]*)\} from "([^"]*Classes)"/g)) {
      const file = resolve(dirname(f), im[2] + '.ts');
      let maps; try { maps = loadMaps(file); } catch { continue; }
      for (const part of im[1].split(',')) {
        const [orig, as] = part.trim().split(/\s+as\s+/);
        if (maps[orig]) alias[(as || orig).trim()] = maps[orig];
      }
    }
    for (const b of t.matchAll(/<button\b([\s\S]{0,700}?)className=\{?([^>]*?)\}?\s*(?:\n|>|\s\w+=)/g)) {
      const expr = b[2];
      let cls = '';
      for (const r of expr.matchAll(/(\w+)\.(\w+)/g)) if (alias[r[1]]?.[r[2]]) cls += ' ' + alias[r[1]][r[2]];
      for (const s of expr.matchAll(/"([^"]*)"|`([^`$]*)/g)) cls += ' ' + (s[1] ?? s[2] ?? '');
      cls = cls.replace(/\s+/g, ' ').trim();
      const h = (cls.match(/(?:^|\s)h-(\d+|\[\d+px\])(?=\s|$)/) || [])[1] || '-';
      const r = (cls.match(/(?:^|\s)rounded(?:-[\w\[\]\.]+)?(?=\s|$)/) || [''])[0].trim() || '-';
      const bg = (cls.match(/(?:^|\s)bg-([a-z][a-z0-9-]*|\[#[0-9a-fA-F]+\])(?=\s|$)/) || [])[1] || '-';
      const line = t.slice(0, b.index).split('\n').length;
      rows.push({ app, f: relative(root, f).replace(/\\/g, '/'), line, h, r, bg, cls });
    }
  }
}
const heightPx = h => h === '-' ? null : h.startsWith('[') ? parseInt(h.slice(1)) : +h * 4;
for (const app of ['partner', 'resident']) {
  const list = rows.filter(x => x.app === app);
  const action = list.filter(x => (heightPx(x.h) ?? 0) >= 40 && x.bg !== '-' && x.bg !== 'transparent');
  console.log(`\n=== ${app}: <button> ${list.length}개 · 높이 40px 이상 채움/흰 배경 액션 버튼 ${action.length}개`);
  const g = new Map();
  for (const x of action) { const k = `${x.h} ${x.r} bg-${x.bg}`; g.set(k, (g.get(k) || []).concat(`${x.f.split('/').slice(-2).join('/')}:${x.line}`)); }
  for (const [k, v] of [...g.entries()].sort((a, b) => b[1].length - a[1].length)) console.log(`  ${String(v.length).padStart(2)}  ${k.padEnd(34)} ${v.slice(0, 3).join(', ')}${v.length > 3 ? ' …' : ''}`);
}
if (process.argv.includes('-v')) {
  console.log('\n\n===== 상세 =====');
  for (const x of rows.filter(x => (heightPx(x.h) ?? 0) >= 40 && x.bg !== '-' && x.bg !== 'transparent'))
    console.log(`${x.app} ${x.f.replace(/^app\/\([a-z]+\)\//, '')}:${x.line}\n    ${x.cls}`);
}
