export type AsStatus = "pending" | "on_hold" | "completed" | "repeat";

export const AS_STATUS: { db: AsStatus; ko: string }[] = [
  { db: "pending", ko: "미결" },
  { db: "on_hold", ko: "보류" },
  { db: "completed", ko: "완결" },
  { db: "repeat", ko: "반복" },
];

export function statusKo(db: string) {
  return AS_STATUS.find((s) => s.db === db)?.ko ?? db;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 정본 접수일시는 날짜만 보인다(`dt.split(' ')[0]`). 접수 시각은 기기 시간대의 날짜로 바꾼다. */
export function fmtDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function splitDateTime(iso: string | null) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** 정본 시간 칸 입력: 숫자만 최대 4자리, 두 자리 뒤에 ':'를 끼운다(`applyMask`에 넘기는 마스크). */
export function timeMask(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/** 정본 시간 칸 blur: 모자란 자리는 앞에 0을 채워 HH:MM으로 맞추고 시는 23, 분은 59를 넘지 않게 한다. */
export function normalizeTime(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const hhmm = digits.padStart(4, "0").slice(0, 4);
  return `${pad(Math.min(23, Number(hhmm.slice(0, 2))))}:${pad(Math.min(59, Number(hhmm.slice(2))))}`;
}

export function combineDateTime(date: string, time: string): string | null {
  if (!date) return null;
  // 입력 중인 시간(예: '09:3')으로 저장해도 날짜가 깨지지 않게 blur와 같은 규칙으로 맞춘다.
  return new Date(`${date}T${normalizeTime(time) || "00:00"}`).toISOString();
}

export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}
