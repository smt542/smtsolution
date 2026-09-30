import type {
  FixedValueChange,
  FixedValueEntry,
  FixedValueKind,
} from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";

/**
 * 호실별 지침 자물쇠 — 정본 `utility-electric|water|gas.dc.html` 의 `.uc-pin`('이 값을 다음 달에도 고정').
 * 세 탭이 같은 코드라 여기 한 벌로 둔다. 고정값은 unit_fixed_values(0203)에 달별 이력으로 쌓인다 —
 * 량(kind usage)·수동입력(kind manual) 모두 켠 달부터 이후 달에 걸리고, 나중 달에 풀거나 바꾸면
 * 그 달부터만 바뀐다(이전 달은 잠금과 그때 값 그대로). 수정 모드에서 잠긴 칸은 입력할 수 없다.
 */
export interface LockDraft {
  /** 량 자물쇠. 켜 두고 저장하면 lockedUsage 가 이 달부터 고정된다. */
  usageLocked: boolean;
  lockedUsage: string;
  /** 수동입력 자물쇠. 켜 두고 저장하면 그 칸의 수동입력 값이 이 달부터 고정된다. */
  manualLocked: boolean;
  manualCharge: string;
}

export function parseDraftNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function round3(value: number): number {
  return Number(value.toFixed(3));
}

/** 전월·금월 지침으로 계산한 량. 가스는 음수가 되지 않도록 보정한다. */
export function usageFromReadings(
  previousReading: string,
  currentReading: string,
  clampNonNegative = false,
): number | null {
  const previous = parseDraftNumber(previousReading);
  const current = parseDraftNumber(currentReading);
  if (previous === null || current === null) return null;
  const usage = current - previous;
  return round3(clampNonNegative ? Math.max(0, usage) : usage);
}

export function usageTextFromReadings(
  previousReading: string,
  currentReading: string,
  clampNonNegative = false,
): string {
  const usage = usageFromReadings(previousReading, currentReading, clampNonNegative);
  return usage === null ? "" : String(usage);
}

/**
 * 저장된 량이 직접 넣은 값(또는 고정값)인지. 서버는 명시 량이 없으면 금월−전월을 그대로 저장하므로
 * (음수는 검토 표시와 함께) 그 차이와 다르면 직접 넣은 값이다. 가스 화면의 0 보정과 비교하면
 * 저장된 음수가 직접 입력으로 잘못 잡혀 다음 저장 때 검토 표시가 풀리므로 보정 없이 비교한다.
 */
export function usageEditedForRow(
  previousReading: number | null,
  currentReading: number | null,
  usage: number | null,
): boolean {
  if (usage === null) return false;
  if (previousReading === null || currentReading === null) return true;
  return round3(currentReading - previousReading) !== round3(usage);
}

export function groupFixedValues(entries: FixedValueEntry[]): Map<number, FixedValueEntry[]> {
  const grouped = new Map<number, FixedValueEntry[]>();
  entries.forEach((entry) => {
    grouped.set(entry.unitId, [...(grouped.get(entry.unitId) ?? []), entry]);
  });
  grouped.forEach((unitEntries) => {
    unitEntries.sort((left, right) => left.fromPeriod.localeCompare(right.fromPeriod));
  });
  return grouped;
}

/** 그 달에 걸린 고정값 = 시작월이 그 달 이하인 이력 중 가장 최근 것의 값(null = 해제·없음). */
export function fixedValueAt(
  entries: FixedValueEntry[] | undefined,
  kind: FixedValueKind,
  period: string,
): number | null {
  let latest: FixedValueEntry | undefined;
  entries?.forEach((entry) => {
    if (entry.kind === kind && entry.fromPeriod <= period
      && (!latest || entry.fromPeriod > latest.fromPeriod)) {
      latest = entry;
    }
  });
  return latest?.value ?? null;
}

export function lockStateFor(
  entries: FixedValueEntry[] | undefined,
  period: string,
) {
  const usageValue = fixedValueAt(entries, "usage", period);
  const manualValue = fixedValueAt(entries, "manual", period);
  return {
    usageLocked: usageValue !== null,
    usageValue,
    manualLocked: manualValue !== null,
    manualValue,
  };
}

/** 이 달에 걸린 고정값으로 자물쇠를 켠 초안 칸. 수동입력 기본값은 저장된 값이 없을 때만 고정값을 쓴다. */
export function initialLockDraft(
  entries: FixedValueEntry[] | undefined,
  period: string,
  savedManualCharge: number | null,
): LockDraft {
  const { usageLocked, usageValue, manualLocked, manualValue } = lockStateFor(entries, period);
  const manual = savedManualCharge ?? (manualLocked ? manualValue : null);
  return {
    usageLocked,
    lockedUsage: usageLocked ? String(usageValue) : "",
    manualLocked,
    manualCharge: manual === null ? "" : String(manual),
  };
}

/**
 * 자물쇠 초안을 이 달 이력 변경으로 바꾼다. 그 달에 걸린 값과 같으면 보내지 않는다(다른 달 이력은 그대로).
 * 서버(save_unit_fixed_values)가 이 달 이전 값과 같아진 이력은 지우고 뒤따르는 중복 이력도 정리한다.
 */
export function fixedChangesFor(
  unitId: number,
  draft: LockDraft,
  entries: FixedValueEntry[] | undefined,
  period: string,
): FixedValueChange[] {
  const usageWas = fixedValueAt(entries, "usage", period);
  const usageNow = draft.usageLocked ? parseDraftNumber(draft.lockedUsage) ?? 0 : null;
  const manualWas = fixedValueAt(entries, "manual", period);
  const manualNow = draft.manualLocked
    ? Math.round(parseDraftNumber(draft.manualCharge) ?? 0)
    : null;
  const changes: FixedValueChange[] = [];
  if (usageNow !== usageWas) changes.push({ unitId, kind: "usage", value: usageNow });
  if (manualNow !== manualWas) changes.push({ unitId, kind: "manual", value: manualNow });
  return changes;
}

/** 켤 때 초안에 넣을 값: 량은 지금 량(없으면 0), 수동입력은 비어 있으면 0 — 정본 `parseInt(raw)||0`. */
export function usageLockPatch(locked: boolean, currentUsage: number | null): Partial<LockDraft> {
  return locked
    ? { usageLocked: false, lockedUsage: "" }
    : { usageLocked: true, lockedUsage: String(currentUsage ?? 0) };
}

export function manualLockPatch(locked: boolean, manualCharge: string): Partial<LockDraft> {
  return locked
    ? { manualLocked: false }
    : { manualLocked: true, manualCharge: manualCharge.trim() === "" ? "0" : manualCharge };
}

const LOCK_PATHS = (
  <>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </>
);

/** 정본 `.uc-pin`: 22px 자물쇠 토글. 켜지면 청록 틴트·테두리. */
export function LockPin({ locked, label, onToggle }: { locked: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={locked}
      aria-label={label}
      title="이 값을 다음 달에도 고정"
      onClick={onToggle}
      className={`flex size-[22px] flex-none items-center justify-center rounded-[6px] border ${locked ? "border-blue bg-blue-t text-blue-d" : "border-transparent text-t4 hover:bg-[#EDF0F3] hover:text-t2"}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3">
        {LOCK_PATHS}
      </svg>
    </button>
  );
}

/** 정본 `td.uc-fixed` 의 값: 11px 자물쇠 + 값(칸 배경은 FIXED_LOCK_CELL). */
export function LockedValue({ value }: { value: number | null }) {
  return (
    <span title="고정된 값이에요" className="num">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mr-1 inline-block size-[11px] align-[-1px] text-t3">
        {LOCK_PATHS}
      </svg>
      {formatNumber(value, { nullText: "0", fractionDigits: 3 })}
    </span>
  );
}

/**
 * 수정 모드에서 자물쇠가 켜진 입력칸(disabled 와 함께 쓴다): 보기 모드 고정 칸과 같은 #F5F7F9 배경·회색
 * 테두리·진한 글자(2026-09-30 사용자 결정). 크기 클래스는 각 표의 입력칸 것을 그대로 붙이고, 공실용
 * `disabled:` 클래스는 섞지 않는다(Tailwind 에서 `disabled:` 가 이 색들을 덮는다).
 */
export const LOCKED_INPUT = "border border-line bg-[#F5F7F9] text-t1 cursor-default";

/** 정본 `#ucUnitBody td.uc-fixed{background:#F5F7F9}` — 보기 모드의 고정 칸. */
export const FIXED_LOCK_CELL = "bg-[#F5F7F9]";
