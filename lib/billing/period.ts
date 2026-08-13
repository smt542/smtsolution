export type Period = string; // 'YYYY-MM-01'

const pad = (n: number) => String(n).padStart(2, "0");

export function currentPeriod(now: Date = new Date()): Period {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
}
export function toMonthInput(period: Period): string {
  return period.slice(0, 7);
}
export function fromMonthInput(ym: string): Period {
  return `${ym}-01`;
}
export function prevPeriod(period: Period): Period {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 2, 1); // m-2: 0-based 전월
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}
export function isFuturePeriod(period: Period, now: Date = new Date()): boolean {
  return period > currentPeriod(now);
}
