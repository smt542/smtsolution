"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { useMe } from "@/hooks/reactquery/auth";
import { useLateFeeRateTiers } from "@/hooks/reactquery/lateFeeTiers";
import { useLateFeeSettings } from "@/hooks/reactquery/setupConfig";
import {
  usePartnerMeterWorkspace,
  useSavePartnerMeterReadings,
  type PartnerMeterUnit,
  type PartnerMeterUtility,
} from "@/hooks/reactquery/utilities";
import { computeLateFee } from "@/lib/billing/lateFee";
import { formatMonth, formatNumber } from "@/lib/format";

import { PartnerBottomActionBar } from "../../../_components/PartnerBottomActionBar";
import { PartnerButton } from "../../../_components/PartnerButton";
import { PartnerConfirmDialog } from "../../../_components/PartnerConfirmDialog";
import { PartnerToast, usePartnerToast } from "../../../_components/PartnerToast";
import { MeterMonthSheet } from "./MeterMonthSheet";
import { METER_KINDS, MeterUnitCard, currentInputId, type MeterField, type MeterFieldValues } from "./MeterUnitCard";
import { meterClasses as styles } from "./meterClasses";
import { applyReadingInput, readingNumber, readingText } from "./meterNumber";

const pad = (n: number) => String(n).padStart(2, "0");
const monthIndex = (year: number, month: number) => year * 12 + month;

/** 이번 달까지 고를 수 있다(다음 달부터 회색). 사무실 공과금 저장도 미래 달을 막는다. */
function isOpenMonth(year: number, month: number) {
  const now = new Date();
  return monthIndex(year, month) <= monthIndex(now.getFullYear(), now.getMonth() + 1);
}

function shiftMonth(value: string, step: number) {
  const [year, month] = value.split("-").map(Number);
  const index = monthIndex(year, month) + step - 1;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

function unitLabel(dong: string | null, unitNo: string) {
  return `${dong ? `${dong} ` : ""}${unitNo}`;
}

/** 정본 `신규` 칩: 선택한 달 말일 기준 입주 60일 이내. */
function isNewTenant(moveInDate: string | null, month: string) {
  if (!moveInDate) return false;
  const [year, monthNo] = month.split("-").map(Number);
  const [inYear, inMonth, inDay] = moveInDate.slice(0, 10).split("-").map(Number);
  const days = Math.round(
    (new Date(year, monthNo, 0).getTime() - new Date(inYear, inMonth - 1, inDay).getTime()) / 86_400_000,
  );
  return days >= 0 && days <= 60;
}

/** 급증 임계: 금월 지침이 전월의 120% 초과(정책서 현장 관리자_검침 자료 3.4). */
const SPIKE_RATIO = 1.2;

/** 경고: 금월 < 전월이면 역전, 전월의 120%를 넘으면 급증. */
function meterWarning(previousText: string, currentText: string) {
  const previous = readingNumber(previousText);
  const current = readingNumber(currentText);
  if (current && previous && current < previous) {
    return {
      up: false,
      text: `금월 지침(${formatNumber(current)})이 전월(${formatNumber(previous)})보다 작아요 · 검침값을 확인해 주세요`,
    };
  }
  if (!previous || !current || current <= previous * SPIKE_RATIO) return null;
  return { up: true, text: `전월 지침 대비 ${Math.round((current / previous - 1) * 100)}% 상승` };
}

/**
 * 세대·공과금별 입력 중인 값. usage가 null이면 량은 금월 − 전월로 계산한다.
 * 전.량은 직전 달 사용량을 상속하고, 고친 값은 meter_readings.prev_usage_override 로 저장한다(0273).
 */
type MeterDraftValue = {
  previous: string;
  current: string;
  prevUsage: string;
  usage: string | null;
};

type MeterDraft = {
  scope: string;
  values: Record<string, MeterDraftValue>;
};

const meterKey = (unitId: number, utility: string) => `${unitId}:${utility}`;

export default function PartnerMeterWorkspace({ buildingId }: { buildingId: number | null }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState<MeterDraft>({ scope: "", values: {} });
  const [confirm, setConfirm] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [spike, setSpike] = useState<{ inputId: string; text: string } | null>(null);
  const warned = useRef(new Set<string>());
  const { toastMessage, showToast } = usePartnerToast();

  const period = `${month}-01`;
  const scope = `${buildingId ?? "none"}:${period}`;
  const meterQuery = usePartnerMeterWorkspace(buildingId, period);
  const saveMutation = useSavePartnerMeterReadings();
  const me = useMe();
  const lateFeeTiers = useLateFeeRateTiers(me.data?.orgId ?? null);
  // 조직 연체료 설정(사용 여부·납기후 가산율). 못 읽으면 기본값으로 계산한다.
  const lateFeeSettings = useLateFeeSettings(me.data?.orgId ?? null);
  const draftValues = draft.scope === scope ? draft.values : {};
  const units = meterQuery.data?.units ?? [];
  const buildingName = meterQuery.data?.buildingName ?? "";
  const isMeterDataLoading = buildingId !== null && meterQuery.isPending;
  const isSavingMeterData = saveMutation.isPending;
  const [year, monthNo] = month.split("-").map(Number);

  /** 상속 전.량 = 직전 달 사용량. */
  const inheritedPrevUsage = (unit: PartnerMeterUnit, kind: PartnerMeterUtility) => {
    const lastUsage = unit.usageHistory[kind]?.[0];
    return lastUsage == null ? "" : readingText(lastUsage);
  };

  const meterOf = (unit: PartnerMeterUnit, kind: PartnerMeterUtility): MeterDraftValue => {
    const edited = draftValues[meterKey(unit.unitId, kind)];
    if (edited) return edited;
    const saved = unit.meters[kind];
    const override = unit.prevUsageOverrides[kind];
    return {
      previous: saved?.previous ?? "",
      current: saved?.current ?? "",
      prevUsage: override != null ? readingText(override) : inheritedPrevUsage(unit, kind),
      usage: null,
    };
  };

  const usageOf = (meter: MeterDraftValue) => {
    if (meter.usage !== null) return meter.usage;
    const current = readingNumber(meter.current);
    if (current === null) return "0";
    return readingText(Math.max(0, current - (readingNumber(meter.previous) ?? 0)));
  };

  const fieldsOf = (unit: PartnerMeterUnit) =>
    Object.fromEntries(
      METER_KINDS.map(({ k }) => {
        const meter = meterOf(unit, k);
        const history = unit.usageHistory[k] ?? [];
        const values: MeterFieldValues = {
          previous: meter.previous,
          current: meter.current,
          prevUsage: meter.prevUsage,
          usage: usageOf(meter),
          // 정본은 값을 고친 묶음에만 경고를 띄운다.
          warning: draftValues[meterKey(unit.unitId, k)] ? meterWarning(meter.previous, meter.current) : null,
          history: [3, 2].map((back) => ({
            month: ((monthNo - back - 1 + 12) % 12) + 1,
            value: history[back - 1] ?? null,
          })),
        };
        return [k, values];
      }),
    ) as Record<PartnerMeterUtility, MeterFieldValues>;

  const isFilled = (unit: PartnerMeterUnit) => METER_KINDS.some(({ k }) => meterOf(unit, k).current !== "");

  const memoOf = (unit: PartnerMeterUnit) =>
    METER_KINDS.flatMap(({ k, l }) => (unit.notes[k] ? [`${l}: ${unit.notes[k]}`] : [])).join(" · ");

  const duesOf = (unit: PartnerMeterUnit) => {
    const unpaid = unit.overduePeriods.reduce((sum, item) => sum + item.unpaidPrincipal, 0);
    const fee = computeLateFee(unit.overduePeriods, lateFeeTiers.data ?? [], year, monthNo, lateFeeSettings);
    return { months: unit.overduePeriods.length, unpaid, late: fee.totalLateFee + fee.totalPostDueFee };
  };

  const checkSpike = (unit: PartnerMeterUnit, kind: PartnerMeterUtility, meter: MeterDraftValue) => {
    const previous = readingNumber(meter.previous);
    const current = readingNumber(meter.current);
    if (!previous || !current || current <= previous * SPIKE_RATIO) return;
    const tag = `${unit.unitId}:${kind}:${current}`;
    if (warned.current.has(tag)) return;
    warned.current.add(tag);
    const kindLabel = METER_KINDS.find((item) => item.k === kind)?.l ?? "";
    const pct = Math.round((current / previous - 1) * 100);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setSpike({
      inputId: currentInputId(unit.unitId, kind),
      text: `${unitLabel(unit.dong, unit.unitNo)} ${kindLabel} 금월 지침이 전월 대비 ${pct}% 상승했어요. 검침값을 다시 확인해 주세요.`,
    });
  };

  const onInput = (unit: PartnerMeterUnit, kind: PartnerMeterUtility, field: MeterField, element: HTMLInputElement) => {
    const value = applyReadingInput(element);
    const meter = meterOf(unit, kind);
    let next: MeterDraftValue;
    if (field === "usage") {
      // 정본: 량을 고치면 금월 = 전월 + 량, 량이 0이면 금월을 비운다.
      const usage = readingNumber(value);
      next = { ...meter, usage: value, current: usage ? readingText((readingNumber(meter.previous) ?? 0) + usage) : "" };
    } else if (field === "prevUsage") {
      next = { ...meter, prevUsage: value };
    } else {
      next = { ...meter, [field]: value, usage: null };
    }
    setDraft((previousDraft) => ({
      scope,
      values: {
        ...(previousDraft.scope === scope ? previousDraft.values : {}),
        [meterKey(unit.unitId, kind)]: next,
      },
    }));
    checkSpike(unit, kind, next);
  };

  const toggle = (unitId: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const goMonth = (next: string) => {
    warned.current = new Set();
    setOpen(new Set());
    setMonth(next);
  };

  const step = (delta: -1 | 1) => {
    const next = shiftMonth(month, delta);
    const [nextYear, nextMonth] = next.split("-").map(Number);
    if (!isOpenMonth(nextYear, nextMonth)) {
      showToast(`${formatMonth(next)} 자료는 아직 생성되지 않았어요`);
      return;
    }
    goMonth(next);
  };

  const save = async () => {
    if (isSavingMeterData || buildingId === null) return;
    const readings = units.flatMap((unit) =>
      METER_KINDS.map(({ k }) => {
        const meter = meterOf(unit, k);
        return {
          unit_id: unit.unitId,
          utility: k,
          previous_reading: meter.previous,
          current_reading: meter.current,
          // 상속값과 같으면 수정값을 남기지 않는다(빈 값 = 수정값 삭제).
          prev_usage: meter.prevUsage === inheritedPrevUsage(unit, k) ? "" : meter.prevUsage,
        };
      }),
    );
    try {
      await saveMutation.mutateAsync({ buildingId, period, readings });
      setDraft({ scope: "", values: {} });
      showToast("검침 자료를 저장했어요");
    } catch {
      showToast("저장에 실패했어요. 다시 시도해 주세요.");
    }
  };

  const doneCount = units.filter(isFilled).length;
  const stepOpen = (delta: -1 | 1) => {
    const [nextYear, nextMonth] = shiftMonth(month, delta).split("-").map(Number);
    return isOpenMonth(nextYear, nextMonth);
  };

  const header = (
    <div className={styles.header}>
      <Link href={buildingId != null ? `/partner/mobile-building?id=${buildingId}` : "/partner/mobile-inquiry"} className={styles.back} aria-label="뒤로">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <div className={styles.titleWrap}>
        <div className={styles.title}>검침 자료</div>
        {buildingName && <div className={styles.sub}>{buildingName}</div>}
      </div>
    </div>
  );

  const stepButton = (delta: -1 | 1) => {
    const enabled = stepOpen(delta);
    return (
      <button
        type="button"
        className={enabled ? styles.step : styles.stepOff}
        aria-label={delta < 0 ? "이전 달" : "다음 달"}
        aria-disabled={!enabled}
        onClick={() => step(delta)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={delta < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
        </svg>
      </button>
    );
  };

  return (
    <div className={styles.root}>
      {header}
      <div className={styles.bar}>
        {stepButton(-1)}
        <button type="button" className={styles.pick} aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>
          <span>{formatMonth(month)}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {stepButton(1)}
        <span className={doneCount === 0 ? styles.countZero : styles.count}>
          {doneCount} / {units.length}세대 입력
        </span>
      </div>

      <div className={styles.scroll}>
        {isMeterDataLoading ? (
          <div className={styles.none} role="status" aria-label="검침 자료 불러오는 중">불러오는 중…</div>
        ) : units.length === 0 ? (
          <div className={styles.none}>세대 정보가 없어요</div>
        ) : (
          units.map((unit) => (
            <MeterUnitCard
              key={unit.unitId}
              unit={unit}
              label={unitLabel(unit.dong, unit.unitNo)}
              isOpen={open.has(unit.unitId)}
              isNew={isNewTenant(unit.moveInDate, month)}
              filled={isFilled(unit)}
              fields={fieldsOf(unit)}
              memo={memoOf(unit)}
              dues={duesOf(unit)}
              onToggle={() => toggle(unit.unitId)}
              onInput={(kind, field, element) => onInput(unit, kind, field, element)}
            />
          ))
        )}
      </div>

      <PartnerBottomActionBar>
        <PartnerButton variant="primary" type="button" className="flex-1" onClick={() => setConfirm(true)} disabled={isSavingMeterData || isMeterDataLoading || units.length === 0}>
          저장
        </PartnerButton>
      </PartnerBottomActionBar>

      {sheetOpen && (
        <MeterMonthSheet
          value={month}
          isOpenMonth={isOpenMonth}
          onSelect={(next) => {
            setSheetOpen(false);
            goMonth(next);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {confirm && (
        <PartnerConfirmDialog
          title="검침 자료를 저장할까요?"
          description={<>{formatMonth(month)} 검침 내용이 저장돼요.</>}
          cancelLabel="취소"
          confirmLabel="저장"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); void save(); }}
          confirmDisabled={isSavingMeterData}
        />
      )}

      {spike && (
        <PartnerConfirmDialog
          icon="warning"
          title="지침이 급증했어요"
          description={spike.text}
          confirmLabel="확인"
          onCancel={() => setSpike(null)}
          onConfirm={() => {
            const input = document.getElementById(spike.inputId);
            setSpike(null);
            if (input instanceof HTMLInputElement) {
              input.focus();
              input.setSelectionRange(input.value.length, input.value.length);
            }
          }}
        />
      )}

      <PartnerToast message={toastMessage} />
    </div>
  );
}
