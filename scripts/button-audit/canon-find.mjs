// 사용법: node canon-find.mjs <정본파일> <라벨텍스트> [최대개수]
// 라벨을 품은 요소의 여는 태그(class·style)와, 그 클래스들의 CSS 규칙을 출력한다.
import { readFileSync } from 'node:fs';

const [file, label, maxArg] = process.argv.slice(2);
const max = Number(maxArg || 4);
const src = readFileSync(file, 'utf8');

// CSS 규칙 수집 (<style> 안 + 인라인 스크립트 문자열 속 규칙까지 거칠게)
const rules = [...src.matchAll(/([^{}<>]{1,200})\{([^{}]{1,600})\}/g)]
  .map(m => ({ sel: m[1].trim(), body: m[2].trim() }))
  .filter(r => /^[.#\w\[:\-\s,>+~*()="']+$/.test(r.sel) && /:/.test(r.body));

let n = 0;
let from = 0;
while (n < max) {
  const i = src.indexOf(label, from);
  if (i < 0) break;
  from = i + label.length;
  // 라벨 앞쪽에서 가장 가까운 class= 를 가진 여는 태그
  const head = src.slice(Math.max(0, i - 1500), i);
  const tags = [...head.matchAll(/<(button|div|a|span|label)\b([^<>]*?)>/g)];
  const tag = tags.reverse().find(t => /class=/.test(t[2]));
  if (!tag) continue;
  n++;
  const cls = (tag[2].match(/class=\\?["']([^"'\\]*)/) || [])[1] || '';
  const style = (tag[2].match(/style=\\?["']([^"'\\]*)/) || [])[1] || '';
  console.log(`\n#${n} <${tag[1]} class="${cls}"${style ? ` style="${style}"` : ''}> …${label}`);
  const names = cls.split(/\s+/).filter(Boolean);
  const seen = new Set();
  for (const r of rules) {
    if (names.some(c => new RegExp(`\\.${c.replace(/[-]/g, '\\-')}(?![\\w-])`).test(r.sel))) {
      const k = r.sel + '{' + r.body + '}';
      if (seen.has(k)) continue;
      seen.add(k);
      console.log(`    ${r.sel}{${r.body}}`);
    }
  }
}
if (!n) console.log(`(없음) ${label}`);
