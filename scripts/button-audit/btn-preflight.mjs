// 치환 사양 사전 검증: 원래 className vs (Button이 내보낼 클래스 + 새 className)을 속성 단위로 비교한다.
// btn-safe.mjs 의 family/value/dropOverridden 을 그대로 가져다 쓴다.
// 사용법: node scripts/button-audit/btn-preflight.mjs <specs.json> [defs/partner.json|defs/resident.json] [-v]
// (defs를 안 주면 웹 Button 기준. 같은 폴더의 btn-safe.mjs에서 규격·양보 규칙을 읽는다.)
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./btn-safe.mjs', import.meta.url), 'utf8');
// btn-safe.mjs 의 순수 함수들만 떼어 와서 평가
const pick = (name) => {
  const s = src.indexOf(`function ${name}(`);
  let d = 0, i = src.indexOf('{', s);
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) break; } }
  return src.slice(s, i + 1);
};
const constBlock = (name) => {
  const s = src.indexOf(`const ${name} =`);
  const e = src.indexOf(';\n', s);
  return src.slice(s, e + 1);
};
const code = [
  constBlock('SIZES'), constBlock('VARIANTS'), constBlock('DISABLED'),
  constBlock('COLOR'), constBlock('SHADOW'), constBlock('RADIUS_TOKEN'), constBlock('FONTSIZE_TOKEN'),
  pick('dropOverridden'), pick('family'), pick('value'),
  'return { SIZES, VARIANTS, DISABLED, dropOverridden, family, value };',
].join('\n');
const base = new Function(code)();
// 4번째 인자로 컴포넌트 정의 JSON({SIZES, VARIANTS, DISABLED})을 주면 그걸로 대조한다(현장·세입자 버튼용).
const defsArg = process.argv.slice(3).find(x => x.endsWith('.json'));
const defs = defsArg ? JSON.parse(readFileSync(defsArg, 'utf8')) : {};
const SIZES = defs.SIZES || base.SIZES, VARIANTS = defs.VARIANTS || base.VARIANTS, DISABLED = defs.DISABLED ?? base.DISABLED;
const { dropOverridden, family, value } = base;

const specs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const famMap = (list) => {
  const m = new Map(), other = new Set();
  for (const c of list) { const k = family(c); if (k) m.set(k, value(c)); else other.add(c); }
  return { m, other };
};
let bad = 0;
for (const s of specs) {
  const orig = s.from.split(/\s+/).filter(Boolean);
  const fin = s.to.split(/\s+/).filter(Boolean);
  // 실제 컴포넌트와 같이: size 클래스는 그대로, variant·비활성만 양보 규칙을 거친다
  const sized = SIZES[s.size].split(' ');
  const defaults = (VARIANTS[s.variant] + ' ' + DISABLED).trim().split(' ');
  const emitted = [...sized, ...dropOverridden(defaults, fin.join(' '))];
  const A = famMap(orig), B = famMap([...emitted, ...fin]);
  const diffs = [];
  for (const [k, v] of A.m) if (!B.m.has(k)) diffs.push(`소실 ${k}=${v}`); else if (B.m.get(k) !== v) diffs.push(`변경 ${k}: ${v} → ${B.m.get(k)}`);
  for (const [k, v] of B.m) if (!A.m.has(k)) diffs.push(`추가 ${k}=${v}`);
  for (const c of A.other) if (!B.other.has(c)) diffs.push(`소실 ${c}`);
  for (const c of B.other) if (!A.other.has(c)) diffs.push(`추가 ${c}`);
  // 같은 속성 두 값이 동시에 남으면 명시도 충돌
  const seen = new Map(), dup = [];
  for (const c of [...emitted, ...fin]) { const k = family(c); if (!k) continue; if (seen.has(k) && value(seen.get(k)) !== value(c)) dup.push(`${seen.get(k)} vs ${c}`); seen.set(k, c); }
  const LAYOUT = /^(추가 (display|items|justify|gap|whitespace)=)/;
  const expected = new Set(s.expect || []);
  const notable = diffs.filter(d => !LAYOUT.test(d) && !expected.has(d));
  const flag = dup.length || notable.length;
  if (flag) bad++;
  console.log(`${flag ? '✗' : '✓'} ${s.id}`);
  for (const d of dup) console.log(`    명시도 충돌: ${d}`);
  for (const d of notable) console.log(`    ${d}`);
  if (process.argv.includes('-v')) for (const d of diffs.filter(d => LAYOUT.test(d) || expected.has(d))) console.log(`    (허용) ${d}`);
}
console.log(bad ? `\n문제 ${bad}건` : '\n전부 통과');
