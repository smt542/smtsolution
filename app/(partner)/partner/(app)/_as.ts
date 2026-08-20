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

export function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function splitDateTime(iso: string | null) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function combineDateTime(date: string, time: string): string | null {
  if (!date) return null;
  return new Date(`${date}T${time || "00:00"}`).toISOString();
}

export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}
