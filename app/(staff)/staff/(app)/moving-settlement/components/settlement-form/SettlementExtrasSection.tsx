"use client";

import { useState, type RefObject } from "react";
import { Button, CustomDropdown, Input, Textarea } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { CalendarIcon, CloseIcon } from "@/components/icons";
import type { MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import {
  MAX_SETTLEMENT_ETC_ITEMS,
  type ChecklistItem,
} from "@/hooks/reactquery/movingSettlement";
import { useVendorCategories } from "@/hooks/reactquery/vendorCategories";
import { useVendors } from "@/hooks/reactquery/vendors";

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
const CLEANING_STATUS_OPTIONS = [
  { value: "완료", label: "완료" },
  { value: "미결", label: "미결" },
];

/** 협력업체 관리의 「청소 업체」 구분 업체 목록(정책 3.8·5절). 구분명을 바꾼 조직은 '청소'가 들어간 구분을 쓴다. */
function useCleaningVendorOptions(current: string) {
  const categoriesQuery = useVendorCategories();
  const vendorsQuery = useVendors();
  const categories = categoriesQuery.data ?? [];
  const category =
    categories.find((item) => item.label.replace(/\s/g, "") === "청소업체") ??
    categories.find((item) => item.label.includes("청소"));
  const names = category
    ? (vendorsQuery.data ?? [])
        .filter((vendor) => vendor.categoryId === category.id)
        .map((vendor) => vendor.name)
    : [];
  // 목록에 없는 저장값(현장 화면 직접 입력·삭제된 업체)도 그대로 보이게 둔다.
  const trimmed = current.trim();
  if (trimmed !== "" && !names.includes(trimmed)) names.unshift(trimmed);
  return Array.from(new Set(names)).map((name) => ({ value: name, label: name }));
}

const dateTriggerClass =
  "flex h-[38px] w-full cursor-pointer items-center justify-between gap-[6px] rounded-[10px] border border-[#dee3e8] bg-white px-[11px] text-[13.5px] font-medium text-t1 outline-none";

export function SettlementExtrasSection({
  value,
  onChange,
  checklist,
  notes,
  onChecklistNoteChange,
  receivedAmount,
  onReceivedAmountChange,
  finalPaidDate,
  onFinalPaidDateChange,
  paymentInputRef,
}: {
  value: MovingSettlementValues;
  onChange: (next: MovingSettlementValues) => void;
  checklist: ChecklistItem[];
  notes: Record<number, string>;
  onChecklistNoteChange: (id: number, note: string) => void;
  receivedAmount: number;
  onReceivedAmountChange: (amount: number) => void;
  finalPaidDate: string;
  onFinalPaidDateChange: (date: string) => void;
  paymentInputRef: RefObject<HTMLInputElement | null>;
}) {
  const cleaningVendorOptions = useCleaningVendorOptions(value.cleaningBy ?? "");
  const etcItems = value.etcItems;
  const etcTotal = etcItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const setEtcItem = (
    index: number,
    patch: Partial<MovingSettlementValues["etcItems"][number]>,
  ) =>
    onChange({
      ...value,
      etcItems: etcItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  const addEtcItem = () => {
    if (etcItems.length >= MAX_SETTLEMENT_ETC_ITEMS) return;
    onChange({ ...value, etcItems: [...etcItems, { name: "", amount: null }] });
  };
  // 정책 3.7: 첫 행 외 삭제 가능.
  const removeEtcItem = (index: number) => {
    if (index === 0) return;
    onChange({
      ...value,
      etcItems: etcItems.filter((_, itemIndex) => itemIndex !== index),
    });
  };
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
          <span className="ml-auto text-[11.5px] font-semibold leading-[14px] text-t3">
            {etcItems.length} / {MAX_SETTLEMENT_ETC_ITEMS}
          </span>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="ml-[9px]"
            onClick={addEtcItem}
            disabled={etcItems.length >= MAX_SETTLEMENT_ETC_ITEMS}
          >
            항목 추가
          </Button>
        </div>
        {etcItems.map((item, index) => (
          <div key={index} className="mt-[10px] grid grid-cols-[1fr_130px_28px] gap-[7px]">
            <Input
              unstyled
              aria-label={`기타 항목명 ${index + 1}`}
              value={item.name}
              onChange={(event) => setEtcItem(index, { name: event.target.value })}
              placeholder="기타 항목"
              className={`${fieldClass} text-[13px] placeholder:font-medium`}
            />
            <Input
              unstyled
              aria-label={`기타 금액 ${index + 1}`}
              type="number"
              min={0}
              value={item.amount ?? ""}
              onChange={(event) =>
                setEtcItem(index, { amount: numericValue(event.target.value) })
              }
              className={amountFieldClass}
            />
            {index === 0 ? (
              <span
                aria-hidden="true"
                className="size-[26px] self-center rounded-[8px] border border-line opacity-0"
              />
            ) : (
              <button
                type="button"
                aria-label={`기타 항목 ${index + 1} 삭제`}
                onClick={() => removeEtcItem(index)}
                className="grid size-[26px] place-items-center self-center rounded-[8px] border border-line text-t3 hover:text-t1"
              >
                <CloseIcon className="size-[12px]" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        <div className="mt-[10px] flex h-[32px] items-baseline justify-center border-t border-line pt-[11px]">
          <span className="text-[14px] font-medium leading-[20px] text-t1">③ 기타 소계</span>
          <strong className="ml-[10px] text-[17px] font-extrabold leading-[21px] tracking-[-0.17px] text-teal-d">
            {new Intl.NumberFormat("ko-KR").format(etcTotal)}
          </strong>
          <span className="ml-[3px] text-[12px] font-bold leading-[15px] text-teal-d opacity-[0.62]">원</span>
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex h-[18px] items-center pb-px">
          <h3 className="text-[14px] font-extrabold leading-[17px] text-t1">청소</h3>
        </div>
        <div className="mt-[10px] grid grid-cols-3 gap-[11px]">
          <label>
            <span className={labelClass}>청소담당</span>
            <div className="w-full [&_.uc-dd]:w-full [&_.uc-dd-btn]:flex [&_.uc-dd-btn]:h-[38px] [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:items-center [&_.uc-dd-btn]:justify-between [&_.uc-dd-btn]:rounded-[10px] [&_.uc-dd-btn]:border-[#dee3e8] [&_.uc-dd-btn]:bg-white [&_.uc-dd-btn]:px-[11px] [&_.uc-dd-btn]:py-0 [&_.uc-dd-btn]:text-[13.5px] [&_.uc-dd-btn]:font-semibold [&_.uc-dd-btn]:tracking-[-0.135px] [&_.uc-dd-btn]:text-t1 [&_.uc-dd-btn]:shadow-none [&_.uc-dd-btn_svg]:size-[14px] [&_.uc-dd-btn_svg]:text-t3">
              <CustomDropdown
                chevron="rotate"
                ariaLabel="청소담당"
                value={value.cleaningBy ?? ""}
                options={cleaningVendorOptions}
                onChange={(next) => onChange({ ...value, cleaningBy: next })}
                placeholder="청소담당"
                variant="field"
              />
            </div>
          </label>
          <label>
            <span className={labelClass}>청소처리</span>
            <div className="w-full [&_.uc-dd]:w-full [&_.uc-dd-btn]:flex [&_.uc-dd-btn]:h-[38px] [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:items-center [&_.uc-dd-btn]:justify-between [&_.uc-dd-btn]:rounded-[10px] [&_.uc-dd-btn]:border-[#dee3e8] [&_.uc-dd-btn]:bg-white [&_.uc-dd-btn]:px-[11px] [&_.uc-dd-btn]:py-0 [&_.uc-dd-btn]:text-[13.5px] [&_.uc-dd-btn]:font-semibold [&_.uc-dd-btn]:tracking-[-0.135px] [&_.uc-dd-btn]:text-t1 [&_.uc-dd-btn]:shadow-none [&_.uc-dd-btn_svg]:size-[14px] [&_.uc-dd-btn_svg]:text-t3">
              <CustomDropdown
                chevron="rotate"
                ariaLabel="청소처리"
                value={value.cleaningStatus}
                options={CLEANING_STATUS_OPTIONS}
                onChange={(next) =>
                  onChange({
                    ...value,
                    cleaningStatus: next === "완료" ? "완료" : "미결",
                  })
                }
                variant="field"
              />
            </div>
          </label>
          <label>
            <span className={labelClass}>청소완료일</span>
            <DpDatePicker
              ariaLabel="청소완료일"
              value={value.cleaningDoneDate ?? ""}
              onChange={(next) => onChange({ ...value, cleaningDoneDate: next })}
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
              <Input
                unstyled
                aria-label="청소금액"
                type="number"
                min={0}
                value={value.cleaningCost ?? ""}
                onChange={(event) =>
                  onChange({ ...value, cleaningCost: numericValue(event.target.value) })
                }
                className={amountFieldClass}
              />
            </label>
            <label>
              <span className={labelClass}>청소계좌</span>
              <Input
                unstyled
                aria-label="청소계좌"
                value={value.cleaningAcct ?? ""}
                onChange={(event) => onChange({ ...value, cleaningAcct: event.target.value })}
                className={`${fieldClass} text-[13px]`}
              />
            </label>
            <label>
              <span className={labelClass}>청소 적요</span>
              <Input
                unstyled
                aria-label="청소 적요"
                value={value.cleaningNote ?? ""}
                onChange={(event) => onChange({ ...value, cleaningNote: event.target.value })}
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
            <Input
              unstyled
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
            {/* block: textarea 는 inline-block 이라 라벨/카드에 줄상자 여백(약 4~7px)이 덧붙는다 */}
            <Textarea
              unstyled
              aria-label="정산 비고"
              value={settlementPrintNote}
              onChange={(event) => setSettlementPrintNote(event.target.value)}
              maxLength={120}
              placeholder="출력물 하단에 표기돼요 (최대 120자)"
              className="block h-[58.5px] min-h-[52px] w-full resize-none rounded-[10px] border border-[#dee3e8] bg-white px-[11px] py-[8px] text-[13px] leading-[19.5px] text-t1 outline-none placeholder:text-t4 focus:border-teal"
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
                    {/* 항목별 메모(0172). 내용이 있으면 체크된 것으로 저장된다. */}
                    <Input
                      unstyled
                      aria-label={item.label}
                      value={notes[item.id] ?? ""}
                      onChange={(event) =>
                        onChecklistNoteChange(item.id, event.target.value)
                      }
                      maxLength={100}
                      placeholder="확인 내용 · 메모"
                      className="h-[34px] rounded-[9px] border border-[#dee3e8] px-[9px] text-[12.5px] text-t1 outline-none placeholder:text-t4 focus:border-teal"
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
        <Textarea
          unstyled
          aria-label="비고"
          value={value.note ?? ""}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
          placeholder="정산 관련 비고를 입력해 주세요"
          className="mt-[10px] block h-[100px] min-h-[100px] w-full resize-none rounded-[10px] border border-[#dee3e8] px-[11px] py-[9px] text-[13px] leading-[20.15px] text-t1 outline-none placeholder:text-t4 focus:border-teal"
        />
      </section>
    </>
  );
}
