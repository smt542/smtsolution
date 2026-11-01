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
export function defaultChargePeriod(period: Period): {
  chargeStartDate: string;
  chargeEndDate: string;
} {
  return {
    chargeStartDate: `${prevPeriod(period).slice(0, 7)}-16`,
    chargeEndDate: `${period.slice(0, 7)}-15`,
  };
}
export function isFuturePeriod(period: Period, now: Date = new Date()): boolean {
  return period > currentPeriod(now);
}

/** 'YYYY-MM-DD' 두 달 사이의 개월 수(일 무시). */
export function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function addMonths(year: number, month: number, months: number): [number, number] {
  const index = year * 12 + (month - 1) + months;
  return [Math.floor(index / 12), (index % 12) + 1];
}

/**
 * 날짜 이월: 기준 날짜와 같은 일(日)을 months 개월 옮긴다(짧은 달은 말일로 맞춤).
 * 기준 날짜가 그 달 말일이었으면 옮긴 달도 말일(2/28 → 3/31).
 */
export function carryDate(value: string, months: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const [nextYear, nextMonth] = addMonths(year, month, months);
  const lastDay = lastDayOfMonth(nextYear, nextMonth);
  const nextDay = day === lastDayOfMonth(year, month) ? lastDay : Math.min(day, lastDay);
  return `${nextYear}-${pad(nextMonth)}-${pad(nextDay)}`;
}
