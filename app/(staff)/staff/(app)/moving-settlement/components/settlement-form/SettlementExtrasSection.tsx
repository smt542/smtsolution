"use client";

import { useState, type RefObject } from "react";
import { Button, CustomDropdown } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { CalendarIcon } from "@/components/icons";
import type { MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import type { ChecklistItem } from "@/hooks/reactquery/movingSettlement";

function numericValue(raw: string): number | null {
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

const cardClass =
  "rounded-[14px] border border-[#dce1e7] bg-white px-[16px] pb-[16px] pt-[15px]";
const fieldClass =
  "h-[38px] w-full rounded-[10px] border border-[#dee3e8] bg-white px-[11px] text-t1 outline-none placeholder:text-t4 focus:border-teal";
const amountFieldClass = `${fieldClass} text-right text-[13.5px] font-semibold`;
const labelClass = "mb-[6px] block h-[14px] text-[12px] font-bold leading-[14px] text-t2";
const dateTriggerClass =
  "flex h-[38px] w-full cursor-pointer items-center justify-between gap-[6px] rounded-[10px] border border-[#dee3e8] bg-white px-[11px] text-[13.5px] font-medium text-t1 outline-none";

export function SettlementExtrasSection({
  value,
  onChange,
  checklist,
  checked,
  onChecklistChange,
  receivedAmount,
  onReceivedAmountChange,
  finalPaidDate,
  onFinalPaidDateChange,
  paymentInputRef,
}: {
  value: MovingSettlementValues;
  onChange: (next: MovingSettlementValues) => void;
  checklist: ChecklistItem[];
  checked: Record<number, boolean>;
  onChecklistChange: (id: number, checked: boolean) => void;
  receivedAmount: number;
  onReceivedAmountChange: (amount: number) => void;
  finalPaidDate: string;
  onFinalPaidDateChange: (date: string) => void;
  paymentInputRef: RefObject<HTMLInputElement | null>;
}) {
  const [cleaningDoneDate, setCleaningDoneDate] = useState("");
  const [cleaningStatus, setCleaningStatus] = useState("completed");
  const [settlementPrintNote, setSettlementPrintNote] = useState("");
  const checklistSplitIndex = Math.ceil(checklist.length / 2);
  const checklistColumns = [
    checklist.slice(0, checklistSplitIndex),
    checklist.slice(checklistSplitIndex),
  ];

  return (
    <>
      <section className={cardClass}>
        <div className="flex h-[27px] items-center pb-px">
          <h3 className="text-[14px] font-extrabold leading-[17px] text-t1">기타</h3>
          <span className="ml-auto text-[11.5px] font-semibold text-t3">1 / 15</span>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="ml-[9px]"
          >
            항목 추가
          </Button>
        </div>
        <div className="mt-[10px] grid grid-cols-[1fr_130px_28px] gap-[7px]">
          <input
            aria-label="수리 메모"
            value={value.repairMemo ?? ""}
            onChange={(event) =>
              onChange({ ...value, repairMemo: event.target.value })
            }
            placeholder="기타 항목"
            className={`${fieldClass} text-[13px] placeholder:font-medium`}
          />
          <input
            aria-label="수리비"
            type="number"
            min={0}
            value={value.repairAmount ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                repairAmount: numericValue(event.target.value),
              })
            }
            className={amountFieldClass}
          />
          <button
            type="button"
            aria-label="기타 항목 삭제"
            className="size-[26px] self-center rounded-[8px] border border-line opacity-0"
          />
        </div>
        <div className="mt-[10px] flex h-[32px] items-baseline justify-center border-t border-line pt-[11px]">
          <span className="text-[14px] font-medium leading-[20px] text-t1">③ 기타 소계</span>
          <strong className="ml-[10px] text-[17px] font-extrabold leading-[20px] tracking-[-0.17px] text-teal-d">
            {new Intl.NumberFormat("ko-KR").format(value.repairAmount ?? 0)}
          </strong>
          <span className="ml-[3px] text-[12px] font-bold leading-[20px] text-teal-d opacity-[0.62]">원</span>
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex h-[18px] items-center pb-px">
          <h3 className="text-[14px] font-extrabold leading-[17px] text-t1">청소</h3>
        </div>
        <div className="mt-[10px] grid grid-cols-3 gap-[11px]">
          <label>
            <span className={labelClass}>청소담당</span>
            <input
              aria-label="청소담당"
              placeholder="청소담당"
              className={`${fieldClass} text-[13.5px] font-semibold placeholder:font-medium placeholder:text-[13px]`}
            />
          </label>
          <label>
            <span className={labelClass}>청소처리</span>
            <div className="w-full [&_.uc-dd]:w-full [&_.uc-dd-btn]:flex [&_.uc-dd-btn]:h-[38px] [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:items-center [&_.uc-dd-btn]:justify-between [&_.uc-dd-btn]:rounded-[10px] [&_.uc-dd-btn]:border-[#dee3e8] [&_.uc-dd-btn]:bg-white [&_.uc-dd-btn]:px-[11px] [&_.uc-dd-btn]:py-0 [&_.uc-dd-btn]:text-[13.5px] [&_.uc-dd-btn]:font-semibold [&_.uc-dd-btn]:tracking-[-0.135px] [&_.uc-dd-btn]:text-t1 [&_.uc-dd-btn]:shadow-none [&_.uc-dd-btn_svg]:size-[14px] [&_.uc-dd-btn_svg]:text-t3">
              <CustomDropdown
                ariaLabel="청소처리"
                value={cleaningStatus}
                options={[{ value: "completed", label: "완료" }]}
                onChange={setCleaningStatus}
                variant="field"
              />
            </div>
          </label>
          <label>
            <span className={labelClass}>청소완료일</span>
            <DpDatePicker
              ariaLabel="청소완료일"
              value={cleaningDoneDate}
              onChange={setCleaningDoneDate}
              placeholder="날짜 선택"
              className="w-full"
              triggerClassName={dateTriggerClass}
              triggerOpenClassName="!border-teal ring-[3px] ring-teal-t"
              endAdornment={<CalendarIcon className="size-[14px] shrink-0 text-t3" aria-hidden="true" />}
            />
          </label>
        </div>
        <div className="mt-[10px] pt-[2px]">
          <div className="grid grid-cols-3 gap-[11px]">
            <label>
              <span className={labelClass}>청소금액</span>
              <input
                aria-label="청소금액"
                type="number"
                min={0}
                defaultValue={0}
                className={amountFieldClass}
              />
            </label>
            <label>
              <span className={labelClass}>청소계좌</span>
              <input aria-label="청소계좌" className={`${fieldClass} text-[13px]`} />
            </label>
            <label>
              <span className={labelClass}>청소 적요</span>
              <input
                aria-label="청소 적요"
                placeholder="청소 관련 적요"
                className={`${fieldClass} text-[13px] font-medium placeholder:font-medium placeholder:text-[13px]`}
              />
            </label>
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex h-[18px] items-center pb-px">
          <h3 className="text-[14px] font-extrabold leading-[17px] text-t1">정산</h3>
        </div>
        <div className="mt-[10px] grid grid-cols-3 gap-[11px]">
          <label>
            <span className={labelClass}>수납액</span>
            <input
              ref={paymentInputRef}
              aria-label="수납액"
              type="number"
              min={0}
              value={receivedAmount || ""}
              onChange={(event) =>
                onReceivedAmountChange(numericValue(event.target.value) ?? 0)
              }
              className={amountFieldClass}
            />
          </label>
          <label>
            <span className={labelClass}>최종 수납일</span>
            <DpDatePicker
              ariaLabel="최종 수납일"
              value={finalPaidDate}
              onChange={onFinalPaidDateChange}
              placeholder="날짜 선택"
              className="w-full"
              triggerClassName={dateTriggerClass}
              triggerOpenClassName="!border-teal ring-[3px] ring-teal-t"
              endAdornment={<CalendarIcon className="size-[14px] shrink-0 text-t3" aria-hidden="true" />}
            />
          </label>
          <div aria-hidden="true" />
        </div>
        <div className="mt-[10px] pt-[2px]">
          <label>
            <span className={labelClass}>비고</span>
            <textarea
              aria-label="정산 비고"
              value={settlementPrintNote}
              onChange={(event) => setSettlementPrintNote(event.target.value)}
              maxLength={120}
              placeholder="출력물 하단에 표기돼요 (최대 120자)"
              className="h-[58.5px] min-h-[52px] w-full resize-none rounded-[10px] border border-[#dee3e8] bg-white px-[11px] py-[8px] text-[13px] leading-[19.5px] text-t1 outline-none placeholder:text-t4 focus:border-teal"
            />
          </label>
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex h-[18px] items-center pb-px">
          <h3 className="text-[14px] font-extrabold leading-[17px] text-t1">정산 체크</h3>
        </div>
        {checklist.length === 0 ? (
          <p className="mt-[10px] text-[12.5px] text-t4">
            등록된 정산 체크 항목이 없어요
          </p>
        ) : (
          <div className="mt-[10px] grid grid-cols-2 gap-x-[20px]">
            {checklistColumns.map((column, columnIndex) => (
              <div key={columnIndex} className="flex flex-col gap-[6px]">
                {column.map((item) => (
                  <label
                    key={item.id}
                    className="grid grid-cols-[124px_1fr] items-center gap-[9px]"
                  >
                    <span className="truncate text-[12px] font-semibold text-t2">
                      {item.label}
                    </span>
                    <input
                      aria-label={item.label}
                      value={checked[item.id] ? "확인" : ""}
                      onChange={(event) =>
                        onChecklistChange(item.id, event.target.value.trim() !== "")
                      }
                      className="h-[34px] rounded-[9px] border border-[#dee3e8] px-[9px] text-[12.5px] text-t1 outline-none focus:border-teal"
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex h-[18px] items-center pb-px">
          <h3 className="text-[14px] font-extrabold leading-[17px] text-t1">비고</h3>
        </div>
        <textarea
          aria-label="비고"
          value={value.note ?? ""}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
          placeholder="정산 관련 비고를 입력해 주세요"
          className="mt-[10px] h-[100px] min-h-[100px] w-full resize-none rounded-[10px] border border-[#dee3e8] px-[11px] py-[9px] text-[13px] leading-[20.15px] text-t1 outline-none placeholder:text-t4 focus:border-teal"
        />
      </section>
    </>
  );
}
