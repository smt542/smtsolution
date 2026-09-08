// CSV 양식 생성 / 파싱 / 검증 — 프로토타입 bulk-import.js 이식.
import type { EntitySchema } from "./schemas";

export interface ValidatedRow {
  line: number;
  rec: Record<string, string>;
  errs: string[];
  bad: Record<string, boolean>;
}
export interface ValidateResult {
  head: string[];
  missing: string[];
  rows: ValidatedRow[];
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function downloadCsv(name: string, rows: unknown[][]): void {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name + ".csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 300);
}

export function parseCSV(text: string): string[][] {
  const t = String(text).replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

const DATE = /^\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2}$/;
const YM = /^\d{4}[-.\/](0?[1-9]|1[0-2])$/;
const NUM = /^-?[\d,]+(\.\d+)?$/;
const TEL = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;

export function validate(schema: EntitySchema, rows: string[][]): ValidateResult {
  const head = rows[0].map((h) => String(h).trim());
  const idx: Record<string, number> = {};
  schema.cols.forEach((c) => { idx[c.k] = head.indexOf(c.k); });
  const missing = schema.cols.filter((c) => c.req && idx[c.k] < 0).map((c) => c.k);
  const body = rows.slice(1);
  const seen: Record<string, boolean> = {};
  const out: ValidatedRow[] = [];
  body.forEach((r, n) => {
    const rec: Record<string, string> = {};
    const errs: string[] = [];
    const bad: Record<string, boolean> = {};
    schema.cols.forEach((c) => {
      const raw = idx[c.k] >= 0 ? r[idx[c.k]] : "";
      const v = String(raw == null ? "" : raw).trim();
      rec[c.k] = v;
      if (c.req && !v) { errs.push(c.k + " 없음"); bad[c.k] = true; return; }
      if (!v) return;
      if (c.num && !NUM.test(v)) { errs.push(c.k + " 숫자 아님"); bad[c.k] = true; }
      if (c.ym && !YM.test(v)) { errs.push(c.k + " 년월형식(YYYY-MM)"); bad[c.k] = true; }
      if (c.date && !DATE.test(v)) { errs.push(c.k + " 날짜형식(YYYY-MM-DD)"); bad[c.k] = true; }
      if (c.tel && !TEL.test(v.replace(/\s/g, ""))) { errs.push(c.k + " 연락처형식"); bad[c.k] = true; }
      if (c.enm && c.enm.indexOf(v) < 0) { errs.push(c.k + "는 " + c.enm.join("/") + " 중 하나"); bad[c.k] = true; }
    });
    const keyCols = schema.uniqBy ?? schema.cols.filter((c) => c.uniq).map((c) => c.k);
    if (keyCols.length) {
      const key = keyCols.map((k) => rec[k]).join("|");
      if (key.replace(/\|/g, "")) {
        if (seen[key]) { errs.push("중복 (" + schema.keyLabel + ")"); keyCols.forEach((k) => { bad[k] = true; }); }
        else seen[key] = true;
      }
    }
    out.push({ line: n + 2, rec, errs, bad });
  });
  return { head, missing, rows: out };
}

// 양식(헤더 + 예시 2행) 행 생성.
export function buildTemplateRows(schema: EntitySchema): string[][] {
  const rows: string[][] = [schema.cols.map((c) => c.k)];
  for (let i = 0; i < 2; i++) rows.push(schema.cols.map((c) => (c.ex && c.ex[i]) || ""));
  return rows;
}

// 오류 행만 모아 사유 열을 붙인 CSV 행 생성.
export function buildErrorRows(schema: EntitySchema, result: ValidateResult): string[][] {
  const head = schema.cols.map((c) => c.k).concat(["오류 사유"]);
  const body = result.rows
    .filter((r) => r.errs.length)
    .map((r) => schema.cols.map((c) => r.rec[c.k]).concat([r.errs.join(" / ")]));
  return [head, ...body];
}
