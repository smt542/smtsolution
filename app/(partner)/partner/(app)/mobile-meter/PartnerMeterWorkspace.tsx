"use client";

import Link from "next/link";
import { useState } from "react";

import {
  usePartnerMeterWorkspace,
  useSavePartnerMeterReadings,
  type PartnerMeterValue,
} from "@/hooks/reactquery/utilities";
import { DpMonthPicker } from "@/components/common/DpMonthPicker";
import { CalendarIcon } from "@/components/icons";
import { formatMonth } from "@/lib/format";

import { PartnerBottomActionBar } from "../../../_components/PartnerBottomActionBar";
import { PartnerConfirmDialog } from "../../../_components/PartnerConfirmDialog";
import { meterClasses as styles } from "./meterClasses";
import { PartnerButton } from "../../../_components/PartnerButton";

const KIND = [
  { k: "water", l: "수도", u: "㎥" },
  { k: "elec", l: "전기", u: "kWh" },
  { k: "gas", l: "가스", u: "㎥" },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

function unitLabel(dong: string | null, unitNo: string) {
  return `${dong ? `${dong} ` : ""}${unitNo}`;
}

function usageOf(m: PartnerMeterValue | undefined) {
  if (!m) return "";
  const p = parseFloat(m.previous);
  const c = parseFloat(m.current);
  if (!isFinite(p) || !isFinite(c)) return "";
  return String(Math.max(0, c - p));
}

type MeterDraft = {
  scope: string;
  values: Record<string, PartnerMeterValue>;
};

const meterKey = (unitId: number, utility: string) => `${unitId}:${utility}`;

export default function PartnerMeterWorkspace({ buildingId }: { buildingId: number | null }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState<MeterDraft>({ scope: "", values: {} });
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const period = `${month}-01`;
  const scope = `${buildingId ?? "none"}:${period}`;
  const meterQuery = usePartnerMeterWorkspace(buildingId, period);
  const saveMutation = useSavePartnerMeterReadings();
  const draftValues = draft.scope === scope ? draft.values : {};
  const units = (meterQuery.data?.units ?? []).map((unit) => ({
    ...unit,
    meters: Object.fromEntries(
      KIND.map(({ k }) => [
        k,
        draftValues[meterKey(unit.unitId, k)]
          ?? unit.meters[k]
          ?? { previous: "", current: "" },
      ]),
    ),
  }));
  const buildingName = meterQuery.data?.buildingName ?? "";
  const isMeterDataLoading = buildingId !== null && meterQuery.isPending;
  const isSavingMeterData = saveMutation.isPending;

  const setMeter = (unitId: number, util: string, field: "previous" | "current", val: string) => {
    const v = val.replace(/[^0-9.]/g, "");
    const unit = units.find((item) => item.unitId === unitId);
    const meter = unit?.meters[util] ?? { previous: "", current: "" };
    setDraft((previousDraft) => ({
      scope,
      values: {
        ...(previousDraft.scope === scope ? previousDraft.values : {}),
        [meterKey(unitId, util)]: { ...meter, [field]: v },
      },
    }));
  };

  const toggle = (unitId: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const save = async () => {
    if (isSavingMeterData || buildingId === null) return;
    setSaved(false);
    const readings = units.flatMap((u) =>
      KIND.map((kd) => ({
        unit_id: u.unitId,
        utility: kd.k,
        previous_reading: u.meters[kd.k]?.previous ?? "",
        current_reading: u.meters[kd.k]?.current ?? "",
      })),
    );
    try {
      await saveMutation.mutateAsync({ buildingId, period, readings });
      setDraft({ scope: "", values: {} });
      setSaved(true);
      setTimeout(() => setSaved(false), 1700);
    } catch {
      setSaved(false);
    }
  };

  const doneCount = units.filter((u) => KIND.some((kd) => (u.meters[kd.k]?.current ?? "") !== "")).length;

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

  return (
    <div className={styles.root}>
      {header}
      <div className={styles.bar}>
        <DpMonthPicker
          value={month}
          onChange={setMonth}
          ariaLabel="검침 년월"
          placeholder="월 선택"
          className={styles.monthPickerRoot}
          triggerClassName={styles.monthPicker}
          triggerOpenClassName={styles.monthPickerOpen}
          endAdornment={<CalendarIcon className="ml-auto size-4 shrink-0 text-t3" aria-hidden="true" />}
        />
        <span className={`${styles.count} ${doneCount === 0 ? styles.countZero : ""}`}>
          {doneCount} / {units.length}세대 입력
        </span>
      </div>

      <div className={styles.scroll}>
        {isMeterDataLoading ? (
          <div className={styles.none} role="status" aria-label="검침 자료 불러오는 중">불러오는 중…</div>
        ) : units.length === 0 ? (
          <div className={styles.none}>세대 정보가 없어요</div>
        ) : (
          units.map((u) => {
            const isOpen = open.has(u.unitId);
            const filled = KIND.some((kd) => (u.meters[kd.k]?.current ?? "") !== "");
            return (
              <div key={u.unitId} className={`${styles.ucell} ${isOpen ? styles.ucellOpen : ""}`}>
                <button type="button" className={styles.uhead} onClick={() => toggle(u.unitId)}>
                  <span className={styles.uho}>{unitLabel(u.dong, u.unitNo)}</span>
                  <span className={styles.unm}>{u.tenantName ?? "공실"}</span>
                  <span className={`${styles.ust} ${filled ? styles.ustOn : ""}`}>{filled ? "입력완료" : "미입력"}</span>
                  <svg className={styles.uchev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isOpen && (
                  <div className={styles.ubody}>
                    {KIND.map((kd) => {
                      const m = u.meters[kd.k] ?? { previous: "", current: "" };
                      return (
                        <div key={kd.k} className={styles.grp}>
                          <div className={styles.grpT}>
                            {kd.l} <em>{kd.u}</em>
                          </div>
                          <div className={styles.g3}>
                            <label className={styles.fld}>
                              <span>전월</span>
                              <input className={styles.fin} inputMode="decimal" placeholder="0" value={m.previous} onChange={(e) => setMeter(u.unitId, kd.k, "previous", e.target.value)} />
                            </label>
                            <label className={styles.fld}>
                              <span>금월</span>
                              <input className={styles.fin} inputMode="decimal" placeholder="0" value={m.current} onChange={(e) => setMeter(u.unitId, kd.k, "current", e.target.value)} />
                            </label>
                            <div className={styles.fld}>
                              <span>사용량</span>
                              <div className={styles.usage}>{usageOf(m) || "-"}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <PartnerBottomActionBar>
        <PartnerButton variant="primary" type="button" className="flex-1" onClick={() => setConfirm(true)} disabled={isSavingMeterData || isMeterDataLoading || units.length === 0}>
          {isSavingMeterData ? "저장 중…" : saved ? "저장했어요" : "저장"}
        </PartnerButton>
      </PartnerBottomActionBar>

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
    </div>
  );
}
