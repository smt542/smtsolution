"use client";

import { Fragment } from "react";

import { Input } from "@/components/common";
import type { PartnerMeterUnit, PartnerMeterUtility } from "@/hooks/reactquery/utilities";
import { formatDate, formatNumber, formatWon } from "@/lib/format";

import { PartnerPhoneLink } from "../../../_components/PartnerPhoneLink";
import { meterClasses as styles } from "./meterClasses";
import { formatReading } from "./meterNumber";

export const METER_KINDS = [
  { k: "water", l: "수도", u: "㎥" },
  { k: "elec", l: "전기", u: "kWh" },
  { k: "gas", l: "가스", u: "㎥" },
] as const satisfies readonly { k: PartnerMeterUtility; l: string; u: string }[];

export type MeterField = "previous" | "current" | "prevUsage" | "usage";

/** 공과금 묶음 하나의 표시값. 숫자는 콤마 없는 문자열이다. */
export type MeterFieldValues = {
  previous: string;
  current: string;
  prevUsage: string;
  usage: string;
  warning: { up: boolean; text: string } | null;
  /** 정본 `.hist`: 3개월 전·2개월 전 사용량. */
  history: { month: number; value: number | null }[];
};

type MeterUnitCardProps = {
  unit: PartnerMeterUnit;
  label: string;
  isOpen: boolean;
  isNew: boolean;
  filled: boolean;
  fields: Record<PartnerMeterUtility, MeterFieldValues>;
  memo: string;
  dues: { months: number; unpaid: number; late: number };
  onToggle: () => void;
  onInput: (kind: PartnerMeterUtility, field: MeterField, element: HTMLInputElement) => void;
};

export const currentInputId = (unitId: number, kind: PartnerMeterUtility) => `meter-${unitId}-${kind}-current`;

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17v.5" />
    </svg>
  );
}

function ReadingField({
  label,
  ariaLabel,
  id,
  value,
  onInput,
}: {
  label: string;
  ariaLabel: string;
  id?: string;
  value: string;
  onInput: (element: HTMLInputElement) => void;
}) {
  return (
    <label className={styles.fld}>
      <span className={styles.fldLabel}>{label}</span>
      <Input
        unstyled
        id={id}
        className={styles.fin}
        inputMode="decimal"
        placeholder="0"
        aria-label={ariaLabel}
        value={formatReading(value)}
        onChange={(event) => onInput(event.currentTarget)}
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fld}>
      <span className={styles.fldLabel}>{label}</span>
      <Input unstyled className={styles.finRo} value={value} readOnly tabIndex={-1} aria-label={label} />
    </div>
  );
}

/** 정본 세대 카드(`.ucell`): 머리(호수·이름·칩) + 펼침(공과금 묶음 3개·입주 정보·미납 합계). */
export function MeterUnitCard({
  unit,
  label,
  isOpen,
  isNew,
  filled,
  fields,
  memo,
  dues,
  onToggle,
  onInput,
}: MeterUnitCardProps) {
  return (
    <div className={styles.ucell}>
      <button type="button" className={styles.uhead} onClick={onToggle} aria-expanded={isOpen}>
        <span className={styles.uho}>{label}</span>
        <span className={styles.unm}>{unit.tenantName ?? "공실"}</span>
        {isNew && <span className={styles.chipNew}>신규</span>}
        <span className={filled ? styles.chipOn : styles.chipOff}>{filled ? "입력완료" : "미입력"}</span>
        <svg className={isOpen ? styles.uchevOpen : styles.uchev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div className={styles.ubody}>
          {METER_KINDS.map((kind) => {
            const field = fields[kind.k];
            const name = `${label} ${kind.l}`;
            return (
              <div key={kind.k} className={styles.grp}>
                <div className={styles.grpT}>
                  {kind.l} <em className={styles.grpUnit}>{kind.u}</em>
                  <span className={field.warning?.up ? styles.histUp : styles.hist}>
                    {field.history.map((item, index) => (
                      <Fragment key={item.month}>
                        {index > 0 && " · "}
                        <b>{item.month}월량</b> {formatNumber(item.value)}
                      </Fragment>
                    ))}
                  </span>
                </div>
                <div className={styles.g2}>
                  <ReadingField label="전월" ariaLabel={`${name} 전월`} value={field.previous} onInput={(element) => onInput(kind.k, "previous", element)} />
                  <ReadingField label="금월" ariaLabel={`${name} 금월`} id={currentInputId(unit.unitId, kind.k)} value={field.current} onInput={(element) => onInput(kind.k, "current", element)} />
                  <ReadingField label="전.량" ariaLabel={`${name} 전.량`} value={field.prevUsage} onInput={(element) => onInput(kind.k, "prevUsage", element)} />
                  <ReadingField label="량" ariaLabel={`${name} 량`} value={field.usage} onInput={(element) => onInput(kind.k, "usage", element)} />
                </div>
                {field.warning && (
                  <div className={styles.warn}>
                    <WarnIcon />
                    {field.warning.text}
                  </div>
                )}
              </div>
            );
          })}
          <div className={styles.row}>
            <span className={styles.rowLabel}>입주민 전화번호</span>
            <div className={styles.tels}>
              {unit.phone ? (
                <PartnerPhoneLink
                  phone={unit.phone}
                  size="lg"
                />
              ) : (
                <span className={styles.telNone}>등록된 번호가 없어요</span>
              )}
            </div>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>입주일</span>
            <span className={styles.rov}>{formatDate(unit.moveInDate)}</span>
          </div>
          <div className={styles.rowCol}>
            <span className={styles.rowLabelAuto}>적요</span>
            <div className={styles.memo}>{memo || "-"}</div>
          </div>
          <div className={styles.dues}>
            <ReadOnlyField label="미납월" value={dues.months ? `${dues.months}개월` : "-"} />
            <ReadOnlyField label="미납총" value={formatWon(dues.unpaid)} />
            <ReadOnlyField label="연체총" value={formatWon(dues.late)} />
          </div>
          <div className={styles.sum}>
            <span>총합액</span>
            <b className={styles.sumValue}>{formatWon(dues.unpaid + dues.late)}</b>
          </div>
        </div>
      )}
    </div>
  );
}
