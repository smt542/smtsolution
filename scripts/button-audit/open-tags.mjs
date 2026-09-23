// node open-tags.mjs <file:line> ... — 해당 줄 이후 첫 <button 의 여는 태그 원문과 라벨 앞부분을 출력
import { readFileSync } from 'node:fs';
function skipString(t, i, q) {
  for (let j = i + 1; j < t.length; j++) {
    if (t[j] === '\\') { j++; continue; }
    if (q === '`' && t[j] === '$' && t[j + 1] === '{') {
      let d = 1; j += 2;
      for (; j < t.length && d > 0; j++) {
        const c = t[j];
        if (c === '{') d++;
        else if (c === '}') d--;
        else if (c === '"' || c === "'" || c === '`') { const e = skipString(t, j, c); if (e < 0) return -1; j = e; }
      }
      j--; continue;
    }
    if (t[j] === q) return j;
  }
  return -1;
}
function tagEnd(t, start) {
  let depth = 0;
  for (let i = start; i < t.length && i < start + 4000; i++) {
    const ch = t[i];
    if (ch === '"' || ch === "'" || (ch === '`' && depth > 0)) { const e = skipString(t, i, ch); if (e < 0) return -1; i = e; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return i;
  }
  return -1;
}
for (const t of process.argv.slice(2)) {
  const k = t.lastIndexOf(':'); const f = t.slice(0, k), line = +t.slice(k + 1);
  const text = readFileSync(f, 'utf8');
  const off = text.split('\n').slice(0, line - 1).join('\n').length;
  const b = text.indexOf('<button', off);
  const e = tagEnd(text, b + 7);
  const close = text.indexOf('</button>', e);
  const inner = text.slice(e + 1, close).replace(/\s+/g, ' ').trim().slice(0, 70);
  console.log(`--- ${f}:${text.slice(0, b).split('\n').length}\n${text.slice(b, e + 1).replace(/\r/g, '')}\n    …${inner}`);
}
