"use client";

import { Button } from "@/components/common";
import {
  giroFooterClass,
  giroFooterDividerClass,
  giroFooterItemClass,
  giroFooterLabelClass,
  giroFooterUnitClass,
  giroFooterValueClass,
} from "./giroClasses";

export function DepositUploadFooter({
  amount,
  count,
  disabled,
  pending,
  onProcess,
}: {
  amount: number;
  count: number;
  disabled: boolean;
  pending: boolean;
  onProcess: () => void;
}) {
  return (
    <>
      <div className={giroFooterClass}>
        <span className={giroFooterItemClass}>
          <em className={giroFooterLabelClass}>수납액 합계</em>
          <b className={giroFooterValueClass}>{amount.toLocaleString("ko-KR")}</b>
          <span className={giroFooterUnitClass}>원</span>
        </span>
        <span className={giroFooterDividerClass} aria-hidden="true" />
        <span className={giroFooterItemClass}>
          <em className={giroFooterLabelClass}>처리 대상</em>
          <b className={giroFooterValueClass}>{count.toLocaleString("ko-KR")}</b>
          <span className={giroFooterUnitClass}>건</span>
        </span>
      </div>
      <div className="flex-1" />
      <Button
        type="button"
        size="modal"
        className="border border-brand shadow-none disabled:border-line disabled:bg-bg disabled:text-t4"
        disabled={disabled}
        onClick={onProcess}
      >
        {pending ? "반영 중…" : "처리"}
      </Button>
    </>
  );
}

