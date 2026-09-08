import type { RefObject } from "react";
import type { MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import type { ChecklistItem } from "@/hooks/reactquery/movingSettlement";

function numericValue(raw: string): number | null {
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

const cardClass =
  "rounded-[14px] border border-[#dce1e7] px-[16px] pb-[16px] pt-[15px]";
const fieldClass =
  "h-[38px] w-full rounded-[10px] border border-[#dee3e8] bg-white px-[11px] text-[13px] text-t1 outline-none placeholder:text-t4 focus:border-teal";
const labelClass = "mb-[6px] block text-[12px] font-bold text-t2";

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
  return (
    <>
      <section className={cardClass}>
        <div className="flex h-[27px] items-center">
          <h3 className="text-[14px] font-extrabold text-t1">기타</h3>
          <span className="ml-auto text-[11.5px] font-semibold text-t3">1 / 15</span>
          <button
            type="button"
            className="ml-[9px] h-[26px] rounded-[8px] border border-line bg-white px-[10px] text-[11.5px] font-bold text-t2"
          >
            항목 추가
          </button>
        </div>
        <div className="mt-[10px] grid grid-cols-[1fr_130px_28px] gap-[7px]">
          <input
            aria-label="수리 메모"
            value={value.repairMemo ?? ""}
            onChange={(event) =>
              onChange({ ...value, repairMemo: event.target.value })
            }
            placeholder="기타 항목"
            className={fieldClass}
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
            className={`${fieldClass} text-right font-semibold`}
          />
          <button
            type="button"
            aria-label="기타 항목 삭제"
            className="invisible size-[26px] self-center rounded-[8px] border border-line"
          />
        </div>
        <div className="mt-[10px] flex items-baseline justify-center border-t border-line pt-[11px]">
          <span className="text-[14px] font-medium text-t1">③ 기타 소계</span>
          <strong className="ml-[10px] text-[17px] font-extrabold tracking-[-0.17px] text-teal-d">
            {new Intl.NumberFormat("ko-KR").format(value.repairAmount ?? 0)}
          </strong>
          <span className="ml-[3px] text-[12px] font-bold text-teal-d/60">원</span>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-[14px] font-extrabold text-t1">청소</h3>
        <div className="mt-[10px] grid grid-cols-3 gap-[11px]">
          <label>
            <span className={labelClass}>청소담당</span>
            <select aria-label="청소담당" defaultValue="" className={fieldClass}>
              <option value="" disabled>업체 선택</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>청소처리</span>
            <select aria-label="청소처리" defaultValue="completed" className={`${fieldClass} font-semibold`}>
              <option value="completed">완료</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>청소완료일</span>
            <input aria-label="청소완료일" type="date" className={fieldClass} />
          </label>
          <label>
            <span className={labelClass}>청소금액</span>
            <input aria-label="청소금액" type="number" min={0} defaultValue={0} className={`${fieldClass} text-right font-semibold`} />
          </label>
          <label>
            <span className={labelClass}>청소계좌</span>
            <input aria-label="청소계좌" className={fieldClass} />
          </label>
          <label>
            <span className={labelClass}>청소 적요</span>
            <input aria-label="청소 적요" placeholder="청소 관련 적요" className={fieldClass} />
          </label>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-[14px] font-extrabold text-t1">정산</h3>
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
              className={`${fieldClass} text-right font-semibold`}
            />
          </label>
          <label>
            <span className={labelClass}>최종 수납일</span>
            <input
              aria-label="최종 수납일"
              type="date"
              value={finalPaidDate}
              onChange={(event) => onFinalPaidDateChange(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-[14px] font-extrabold text-t1">정산 체크</h3>
        {checklist.length === 0 ? (
          <p className="mt-[10px] text-[12.5px] text-t4">
            등록된 정산 체크 항목이 없습니다.
          </p>
        ) : (
          <div className="mt-[10px] grid grid-cols-2 gap-x-[20px] gap-y-[6px]">
            {checklist.map((item) => (
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
        )}
      </section>

      <section className={cardClass}>
        <h3 className="text-[14px] font-extrabold text-t1">비고</h3>
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
