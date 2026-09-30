import type { FixedValueRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";

/**
 * 호실별 지침 자물쇠 — 정본 `utility-electric|water|gas.dc.html` 의 `.uc-pin`('이 값을 다음 달에도 고정').
 * 세 탭이 같은 코드라 여기 한 벌로 둔다. 량은 unit_meters.fixed_usage, 수동입력은 fixed_manual_charge(0199)이고,
 * 각각 적용 시작월(`*_from`)부터 이후 달에 걸린다.
 */
export interface LockDraft {
  /** 량 자물쇠. 켜 두고 저장하면 lockedUsage 가 이 달부터 고정된다. */
  usageLocked: boolean;
  lockedUsage: string;
  /** 수동입력 자물쇠. 켜 두고 저장하면 그 칸의 수동입력 값이 이 달부터 고정된다. */
  manualLocked: boolean;
}

export function parseDraftNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 고정값은 적용 시작월(월 1일)부터 이후 달에 걸린다. 시작월이 없으면(옛 고정 사용량) 늘 걸린다. */
export function lockStateFor(fixed: FixedValueRow | undefined, period: string) {
  const appliesAt = (from: string | null) => from === null || from <= period;
  return {
    usageLocked: fixed?.fixedUsage != null && appliesAt(fixed.fixedUsageFrom),
    manualLocked: fixed?.fixedManualCharge != null && appliesAt(fixed.fixedManualChargeFrom),
  };
}

/** 이 달에 걸린 고정값으로 자물쇠를 켠 초안 칸. 수동입력 기본값은 저장된 값이 없을 때만 고정값을 쓴다. */
export function initialLockDraft(
  fixed: FixedValueRow | undefined,
  period: string,
  savedManualCharge: number | null,
): LockDraft & { manualCharge: string } {
  const { usageLocked, manualLocked } = lockStateFor(fixed, period);
  const manual = savedManualCharge ?? (manualLocked ? fixed?.fixedManualCharge ?? null : null);
  return {
    usageLocked,
    lockedUsage: usageLocked ? String(fixed?.fixedUsage ?? 0) : "",
    manualLocked,
    manualCharge: manual === null ? "" : String(manual),
  };
}

/**
 * 자물쇠 상태를 저장할 고정값으로 바꾼다. 켜고 끄지 않았고 값도 그대로면 건드리지 않는다
 * (다른 달에서 건 고정도 그대로 둔다). 새로 켜면 이 달부터, 이미 걸려 있으면 원래 시작월을 유지한다.
 */
export function fixedChangeFor(
  unitId: number,
  draft: LockDraft & { manualCharge: string },
  fixed: FixedValueRow | undefined,
  period: string,
): FixedValueRow | null {
  const was = lockStateFor(fixed, period);
  const usage = draft.usageLocked ? parseDraftNumber(draft.lockedUsage) ?? 0 : null;
  const manualParsed = draft.manualLocked ? parseDraftNumber(draft.manualCharge) ?? 0 : null;
  const manual = manualParsed === null ? null : Math.round(manualParsed);
  const usageSame = draft.usageLocked === was.usageLocked && (!draft.usageLocked || usage === fixed?.fixedUsage);
  const manualSame = draft.manualLocked === was.manualLocked && (!draft.manualLocked || manual === fixed?.fixedManualCharge);
  if (usageSame && manualSame) return null;
  return {
    unitId,
    fixedUsage: usageSame ? fixed?.fixedUsage ?? null : usage,
    fixedUsageFrom: usageSame
      ? fixed?.fixedUsageFrom ?? null
      : usage === null ? null : was.usageLocked ? fixed?.fixedUsageFrom ?? null : period,
    fixedManualCharge: manualSame ? fixed?.fixedManualCharge ?? null : manual,
    fixedManualChargeFrom: manualSame
      ? fixed?.fixedManualChargeFrom ?? null
      : manual === null ? null : was.manualLocked ? fixed?.fixedManualChargeFrom ?? null : period,
  };
}

/** 켤 때 초안에 넣을 값: 량은 지금 량(없으면 0), 수동입력은 비어 있으면 0 — 정본 `parseInt(raw)||0`. */
export function usageLockPatch(locked: boolean, currentUsage: number | null): Partial<LockDraft> {
  return locked
    ? { usageLocked: false, lockedUsage: "" }
    : { usageLocked: true, lockedUsage: String(currentUsage ?? 0) };
}

export function manualLockPatch(locked: boolean, manualCharge: string): Partial<LockDraft> & { manualCharge?: string } {
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

/** 정본 `#ucUnitBody td.uc-fixed{background:#F5F7F9}` — 보기 모드의 고정 칸. */
export const FIXED_LOCK_CELL = "bg-[#F5F7F9]";
