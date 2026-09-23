// 공통 Button 치환 후보 분석 (v2, 2026-09-23)
//
// v1 대비 보강한 사각지대 3개:
//  1. variant 판정을 이름이 아니라 값으로 한다. v1은 `bg-surface`(=#fff)를 흰 배경으로
//     못 알아봐 ghost 버튼 8개소를 "variant 불명"으로, `bg-red-t`(연한 빨강)를
//     `\bbg-red\b` 오탐으로 danger로 분류했다.
//  2. 컴포넌트가 "추가"하는 속성도 검사한다. v1은 호출부와 값이 다른 것(충돌)만 봐서,
//     호출부에 그림자가 없던 버튼에 `shadow-pri`가 새로 붙는 경우를 통과시켰다
//     (배치 1 공과금 "전체 이월", 배치 2 FeeItemFormDialog 2개소가 이렇게 회귀).
//  3. 태그 끝을 중괄호·문자열을 고려해 찾는다. v1은 `onClick={() => …}`의 `>`에서
//     태그가 끊겨 className을 못 읽었다.
//
// 사용법(repo 루트에서): node scripts/button-audit/btn-safe.mjs [-v]   (-v: 막힌 지점의 className 전체 출력)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const VERBOSE = process.argv.includes('-v');

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    if (['node_modules', '.next', '.git', '.gstack', '_notes'].includes(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) files.push(p.split(sep).join('/'));
  }
})('.');
const src = files.filter(f => f.startsWith('app/') || f.startsWith('components/'));

// components/common/Button.tsx 와 같아야 한다.
const SIZES = {
  std: 'inline-flex items-center justify-center gap-1.5 h-10 rounded-btn px-[15px] text-[13.5px] font-bold whitespace-nowrap',
  sm: 'h-[26px] rounded-lg px-[10px] text-[11.5px] font-bold',
  login: 'h-[50px] rounded-[14px] text-[15px] font-extrabold',
};
const VARIANTS = {
  primary: 'bg-brand text-white shadow-pri hover:bg-brand-dark',
  ghost: 'bg-white text-t2 border border-line hover:bg-bg',
  danger: 'bg-danger text-white',
  dangerTint: 'border border-red-t bg-red-t text-red',
};
const DISABLED = 'disabled:bg-bg disabled:text-t4';
// Button.dropOverridden 과 같은 양보 규칙
function dropOverridden(defaults, cls) {
  const yieldDisabled = /\bdisabled:(bg|text|opacity|border)-/.test(cls);
  const yieldHover = cls.includes('hover:bg-');
  const yieldShadow = /(^|\s)shadow-/.test(cls);
  return defaults.filter(c =>
    !(yieldDisabled && c.startsWith('disabled:')) &&
    !(yieldHover && c.startsWith('hover:bg-')) &&
    !(yieldShadow && c.startsWith('shadow-')));
}

// 같은 CSS 속성을 건드리는 클래스끼리 묶는 키. 값이 다르면 충돌이다.
function family(c) {
  const m = c.match(/^((?:[a-z-]+:)*)(.*)$/);
  const pre = m[1], base = m[2];
  const k =
    /^h-/.test(base) ? 'height' :
    /^rounded(-|$)/.test(base) ? 'radius' :
    /^px-/.test(base) ? 'px' :
    /^text-\[[\d.]+px\]$/.test(base) ? 'fontsize' :
    /^text-(xs|sm|base|lg|xl)$/.test(base) ? 'fontsize' :
    /^text-(left|center|right|justify)$/.test(base) ? null :
    /^text-/.test(base) ? 'color' :
    /^bg-/.test(base) ? 'bg' :
    /^border-(\d|\[\d)/.test(base) ? 'borderwidth' :
    /^border-/.test(base) ? 'bordercolor' :
    /^border$/.test(base) ? 'borderwidth' :
    /^(flex|inline-flex|grid|inline-grid|block|inline-block)$/.test(base) ? 'display' :
    /^items-/.test(base) ? 'items' :
    /^justify-/.test(base) ? 'justify' :
    /^gap-/.test(base) ? 'gap' :
    /^shadow(-|$)/.test(base) ? 'shadow' :
    /^whitespace-/.test(base) ? 'whitespace' :
    /^font-(thin|light|normal|medium|semibold|bold|extrabold|black)$/.test(base) ? 'fontweight' :
    null;
  return k ? pre + k : null;
}

// 이름이 달라도 값이 같으면 같은 것이다. 비교는 값으로 한다. (app/globals.css 토큰 = 정본 :root)
const COLOR = new Map(Object.entries({
  brand: 'TEAL', blue: 'TEAL', teal: 'TEAL', '[#14a497]': 'TEAL',
  'brand-dark': 'TEAL_D', 'blue-d': 'TEAL_D', 'teal-d': 'TEAL_D', '[#0e8677]': 'TEAL_D',
  'brand-tint': 'TEAL_T', 'blue-t': 'TEAL_T', 'teal-t': 'TEAL_T', '[#e2f5f1]': 'TEAL_T',
  white: 'WHITE', surface: 'WHITE', '[#fff]': 'WHITE', '[#ffffff]': 'WHITE',
  danger: 'RED', red: 'RED', '[#f04452]': 'RED',
  'red-t': 'RED_T', '[#fdecee]': 'RED_T',
  bg: 'BG', '[#f2f4f6]': 'BG',
  line: 'LINE', '[#e8ebee]': 'LINE',
  line2: 'LINE2', '[#f1f3f5]': 'LINE2',
  t2: 'T2', '[#4e5968]': 'T2',
  t4: 'T4', '[#b0b8c1]': 'T4',
}));
const SHADOW = new Map(Object.entries({
  pri: 'PRI', 'hf-btn': 'PRI',
  '[0_6px_14px_-4px_rgba(20,164,151,0.5)]': 'PRI', '[0_6px_14px_-4px_rgba(20,164,151,.5)]': 'PRI',
}));
const RADIUS_TOKEN = { none: 0, sm: 2, md: 6, lg: 8, xl: 12, '2xl': 16, '3xl': 24, full: 9999, btn: 11, in: 12, card: 15, panel: 15, modal: 20, pill: 9999, field: 11 };
const FONTSIZE_TOKEN = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20 };

/** 클래스를 비교 가능한 값으로 정규화. 모르면 클래스 문자열 그대로. */
function value(c) {
  const base = c.replace(/^(?:[a-z-]+:)*/, '');
  let m;
  if ((m = base.match(/^h-\[([\d.]+)px\]$/))) return +m[1];
  if ((m = base.match(/^h-(\d+(?:\.\d+)?)$/))) return +m[1] * 4;
  if ((m = base.match(/^px-\[([\d.]+)px\]$/))) return +m[1];
  if ((m = base.match(/^px-(\d+(?:\.\d+)?)$/))) return +m[1] * 4;
  if ((m = base.match(/^gap-\[([\d.]+)px\]$/))) return +m[1];
  if ((m = base.match(/^gap-(\d+(?:\.\d+)?)$/))) return +m[1] * 4;
  if ((m = base.match(/^rounded-\[([\d.]+)px\]$/))) return +m[1];
  if ((m = base.match(/^rounded-([a-z0-9]+)$/))) return RADIUS_TOKEN[m[1]] ?? base;
  if (base === 'rounded') return 4;
  if ((m = base.match(/^text-\[([\d.]+)px\]$/))) return +m[1];
  if ((m = base.match(/^text-(xs|sm|base|lg|xl)$/))) return FONTSIZE_TOKEN[m[1]];
  if ((m = base.match(/^(?:bg|text|border)-(.+)$/))) return COLOR.get(m[1].toLowerCase()) ?? base;
  if ((m = base.match(/^shadow-(.+)$/))) return SHADOW.get(m[1]) ?? base;
  return base;
}

const plain = c => !c.includes(':');
function variantOf(tokens) {
  const bg = tokens.filter(c => plain(c) && family(c) === 'bg').map(value);
  const bc = tokens.filter(c => plain(c) && family(c) === 'bordercolor').map(value);
  if (bg.includes('TEAL')) return 'primary';
  if (bg.includes('WHITE') && bc.includes('LINE')) return 'ghost';
  if (bg.includes('RED')) return 'danger';
  if (bg.includes('RED_T')) return 'dangerTint';
  return null;
}
function geom(tokens) {
  const g = { h: null, r: null, t: null };
  for (const c of tokens.filter(plain)) {
    const k = family(c);
    if (k === 'height' && typeof value(c) === 'number') g.h = value(c);
    if (k === 'radius' && typeof value(c) === 'number') g.r = value(c);
    if (k === 'fontsize') g.t = value(c);
  }
  return g;
}

// ── JSX 스캔: 문자열·중괄호를 고려해 여는 태그 끝을 찾는다 ──
function skipString(t, i, q) {
  for (let j = i + 1; j < t.length; j++) {
    if (t[j] === '\\') { j++; continue; }
    if (q === '`' && t[j] === '$' && t[j + 1] === '{') {
      let d = 1; j += 2;
      for (; j < t.length && d > 0; j++) {
        if (t[j] === '{') d++;
        else if (t[j] === '}') d--;
        else if (t[j] === '"' || t[j] === "'" || t[j] === '`') { const e = skipString(t, j, t[j]); if (e < 0) return -1; j = e; }
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
/** className 표현식 안의 문자열 리터럴(템플릿 정적 부분·${} 안 문자열 포함)을 모은다. */
function literals(expr) {
  const out = [];
  for (let i = 0; i < expr.length; i++) {
    const q = expr[i];
    if (q !== '"' && q !== "'" && q !== '`') continue;
    const e = skipString(expr, i, q);
    if (e < 0) break;
    let body = expr.slice(i + 1, e);
    if (q === '`') {
      // ${…} 안의 문자열도 후보로 모으고, 정적 부분만 남긴다
      body = body.replace(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, inner) => { out.push(literals(inner)); return ' '; });
    }
    out.push(body);
    i = e;
  }
  return out.join(' ');
}
function classNameOf(attrs) {
  const k = attrs.search(/\bclassName\s*=/);
  if (k < 0) return null;
  let j = attrs.indexOf('=', k) + 1;
  while (/\s/.test(attrs[j])) j++;
  if (attrs[j] === '"' || attrs[j] === "'") return attrs.slice(j + 1, attrs.indexOf(attrs[j], j + 1));
  if (attrs[j] === '{') {
    let d = 0, e = j;
    for (; e < attrs.length; e++) {
      if (attrs[e] === '"' || attrs[e] === "'" || attrs[e] === '`') { const s = skipString(attrs, e, attrs[e]); if (s < 0) break; e = s; continue; }
      if (attrs[e] === '{') d++;
      else if (attrs[e] === '}') { d--; if (d === 0) break; }
    }
    return literals(attrs.slice(j + 1, e));
  }
  return null;
}

// 정본 대조로 "공통 Button 대상이 아님"이 결정된 파일 (2026-09-23). 치환 후보에서 빼고 사유와 함께 따로 보여 준다.
// 이 파일에 버튼이 새로 생기면 여기 목록에도 같이 뜨므로, 사유가 맞는지 다시 확인할 것.
const MODAL = '정본 모달 계열(.fmpc-btn·.mvq-b·.asp-btn·.lg-print) — raw 유지 결정';
const EXCLUDE = {
  'app/(staff)/staff/(app)/management-fee/components/ManagementFeeDialog.tsx': MODAL,
  'app/(staff)/staff/(app)/messaging/components/MessageDetailModal.tsx': MODAL,
  'app/(staff)/staff/(app)/messaging/components/TemplateFormModal.tsx': MODAL,
  'app/(staff)/staff/(app)/fee-items/components/FeeItemFormDialog.tsx': MODAL,
  'app/(staff)/staff/(app)/notices/components/NoticeAlimtalkConfirmModal.tsx': MODAL,
  'app/(staff)/staff/(app)/notices/components/NoticeDetailModal.tsx': MODAL,
  'app/(staff)/staff/(app)/notices/components/NoticeFormModal.tsx': MODAL,
  'app/(staff)/staff/(app)/moving-settlement/components/SettlementDecisionDialog.tsx': MODAL,
  'components/common/ConfirmDialog.tsx': MODAL,
  'components/shell/as-rail/MoveOutConfirmDialog.tsx': MODAL,
  'components/shell/as-rail/AsReportModal.tsx': MODAL,
  'app/(staff)/staff/(app)/bill/components/output-modal/OutputModalPrimitives.tsx': MODAL,
  'app/(staff)/staff/(app)/utilities/components/GasLedgerModal.tsx': MODAL,
  'app/(staff)/staff/(app)/utilities/components/MeterLedgerModal.tsx': MODAL,
  'app/(staff)/staff/(app)/receipts/components/ChargeReceiptReportModal.tsx': MODAL,
  'app/(staff)/staff/(app)/receipts/components/monthly/MonthlyChargeModal.tsx': MODAL,
  'app/(staff)/staff/(app)/receipts/components/unit-statement/UnitStatementModal.tsx': MODAL,
  'app/(staff)/staff/(app)/receipts/components/villa-overdue/VillaOverdueModal.tsx': MODAL,
  'app/(staff)/staff/(app)/receipts/components/villa-receipts/VillaReceiptHistoryModal.tsx': MODAL,
  'app/(staff)/staff/(app)/moving-settlement/components/SettlementActionBar.tsx': '정본 .hf-btn + `.ms-actbar .hf-btn{padding:0 10px}` 문맥 규칙 — size로 표현 불가',
  'app/(platform-admin)/platform-admin/(app)/points/organizations/OrganizationsPointsWorkspace.tsx': 'Button에 없는 색(투명 = 정본 .hf-btn.ghost 패턴) — raw 유지 결정',
};

// 속성 추가가 "보이는" 변화인 것만 막는다. 레이아웃 계열(display·gap 등)은 참고로만 표시.
const VISIBLE_ADD = new Set(['shadow', 'borderwidth', 'bordercolor', 'hover:bg', 'color', 'fontweight']);

const safe = [], blocked = [], excluded = [];
let buttonCount = 0;

for (const f of src) {
  const text = readFileSync(f, 'utf8');
  buttonCount += (text.match(/<Button\b/g) || []).length;
  for (const m of text.matchAll(/<button\b/g)) {
    const end = tagEnd(text, m.index + 7);
    if (end < 0) continue;
    const cls = classNameOf(text.slice(m.index + 7, end));
    if (!cls) continue;
    const tokens = cls.split(/\s+/).filter(Boolean);
    const { h, r, t } = geom(tokens);
    const bucket = (h === 40 && r === 11 && t === 13.5) ? 'std' : (h === 26 && r === 8 && t === 11.5) ? 'sm'
      : (h === 50 && r === 14 && t === 15) ? 'login' : null;
    if (!bucket) continue;
    const line = text.slice(0, m.index).split('\n').length;
    const v = variantOf(tokens);
    const rec = { f, line, bucket, variant: v, cls: tokens.join(' ') };
    if (EXCLUDE[f]) { excluded.push({ ...rec, why: EXCLUDE[f] }); continue; }

    if (!v) { blocked.push({ ...rec, why: 'variant 불명(Button에 없는 색 조합)' }); continue; }
    if (bucket === 'sm' && v !== 'ghost') { blocked.push({ ...rec, why: 'sm + 채움 — 유지 결정(단, 정본에 .uc-mini.pri 있음)' }); continue; }

    // 1) 컴포넌트 기본값과 값이 같은 호출부 클래스는 중복이라 뺀다 (양보 규칙 적용 전 기준).
    //    예: shadow-hf-btn = shadow-pri, hover:bg-teal-d = hover:bg-brand-dark
    const defaults = (SIZES[bucket] + ' ' + VARIANTS[v] + ' ' + DISABLED).split(' ');
    const defaultFam = new Map();
    for (const c of defaults) { const k = family(c); if (k) defaultFam.set(k, value(c)); }
    const rest = tokens.filter(c => {
      const k = family(c);
      return !(k && defaultFam.has(k) && defaultFam.get(k) === value(c));
    });
    // 2) 남은 클래스(=치환 후 className)로 양보 규칙을 적용해 컴포넌트가 실제로 내보낼 클래스를 구한다
    const emitted = dropOverridden(defaults, rest.join(' '));
    const emittedFam = new Map();
    for (const c of emitted) { const k = family(c); if (k) emittedFam.set(k, value(c)); }
    const callFam = new Set(tokens.map(family).filter(Boolean));
    const conflicts = rest.filter(c => { const k = family(c); return k && emittedFam.has(k) && emittedFam.get(k) !== value(c); });
    // 3) 호출부에 없던 속성을 컴포넌트가 새로 얹는 것
    const added = emitted.filter(c => { const k = family(c); return k && !callFam.has(k); });
    const addedVisible = added.filter(c => VISIBLE_ADD.has(family(c)));

    if (conflicts.length) blocked.push({ ...rec, why: '충돌: ' + [...new Set(conflicts)].join(' ') });
    else if (addedVisible.length) blocked.push({ ...rec, why: '표시 추가: ' + addedVisible.join(' ') });
    else safe.push({ ...rec, keep: rest.join(' '), added: added.filter(c => !VISIBLE_ADD.has(family(c))) });
  }
}

console.log(`<Button> ${buttonCount}개소`);
console.log('\n===== 안전 치환 가능 ' + safe.length + '개소 =====');
for (const s of safe) {
  console.log(`  ${s.bucket.padEnd(5)} ${s.f}:${s.line}  variant=${s.variant}${s.keep ? '  keep=[' + s.keep + ']' : ''}`);
  if (VERBOSE && s.added.length) console.log(`      (레이아웃 추가: ${s.added.join(' ')})`);
}
console.log('\n===== 막힌 ' + blocked.length + '개소 (사유별) =====');
const cat = b => b.why.startsWith('충돌') ? '충돌' : b.why.startsWith('표시 추가') ? '표시 추가(그림자·테두리·hover 등)' : b.why;
const by = new Map();
for (const b of blocked) by.set(cat(b), (by.get(cat(b)) || 0) + 1);
for (const [k, n] of [...by.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${k}`);
for (const k of by.keys()) {
  console.log(`\n--- ${k} ---`);
  for (const b of blocked.filter(x => cat(x) === k)) {
    console.log(`  ${b.f}:${b.line}${b.why !== k ? '  ' + b.why.replace(/^[^:]*:\s*/, '') : ''}`);
    if (VERBOSE) console.log(`      ${b.cls}`);
  }
}

console.log('\n===== 정본 제외(결정됨) ' + excluded.length + '개소 =====');
const byEx = new Map();
for (const e of excluded) { if (!byEx.has(e.why)) byEx.set(e.why, []); byEx.get(e.why).push(e); }
for (const [why, list] of byEx) {
  console.log(`\n--- ${why} (${list.length}) ---`);
  for (const e of list) { console.log(`  ${e.f}:${e.line}`); if (VERBOSE) console.log(`      ${e.cls}`); }
}
