import { Input, Select } from "@/components/common";
import {
  movingSettlementSchema,
  type MovingSettlementValues,
} from "@/components/forms/schema/movingSettlement";
import { calculateSettlementAmount } from "@/hooks/reactquery/movingSettlement";

export type SettlementDraft = MovingSettlementValues;

export function calculateProratedMgmtFee(
  monthly: number | null,
  moveOutDate: string,
): number {
  if (monthly === null || moveOutDate === "") return 0;

  const [year, month, day] = moveOutDate.split("-").map(Number);
  if (!year || !month || !day) return 0;

  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.round((monthly * day) / daysInMonth);
}

function numberValue(raw: string): number | null {
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SettlementForm({
  value,
  onChange,
}: {
  value: SettlementDraft;
  onChange: (next: SettlementDraft) => void;
}) {
  const set = <K extends keyof SettlementDraft>(
    key: K,
    next: SettlementDraft[K],
  ) => onChange({ ...value, [key]: next });
  const amount = calculateSettlementAmount(value);
  const valid = movingSettlementSchema.safeParse(value).success;

  const setMoveOutDate = (moveOutDate: string) =>
    onChange({
      ...value,
      moveOutDate,
      mgmtFeeProrated: calculateProratedMgmtFee(
        value.mgmtFeeMonthly,
        moveOutDate,
      ),
    });

  const setMonthly = (mgmtFeeMonthly: number | null) =>
    onChange({
      ...value,
      mgmtFeeMonthly,
      mgmtFeeProrated: calculateProratedMgmtFee(
        mgmtFeeMonthly,
        value.moveOutDate,
      ),
    });

  const amountInput = (
    label: string,
    key:
      | "mgmtFeeMonthly"
      | "mgmtFeeProrated"
      | "waterCharge"
      | "elecCharge"
      | "gasCharge"
      | "repairAmount",
    onAmount?: (next: number | null) => void,
  ) => (
    <label>
      <span className="mb-1.5 block text-xs font-bold text-t2">{label}</span>
      <Input
        aria-label={label}
        type="number"
        min={0}
        step={1}
        value={value[key] ?? ""}
        onChange={(event) => {
          const next = numberValue(event.target.value);
          if (onAmount) onAmount(next);
          else set(key, next);
        }}
      />
    </label>
  );

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-t1">이사정산 입력</h2>
        <span
          className={
            valid
              ? "text-xs font-bold text-green"
              : "text-xs font-bold text-red"
          }
        >
          {valid ? "입력 가능" : "필수값 확인"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">퇴실일</span>
          <Input
            aria-label="퇴실일"
            type="date"
            value={value.moveOutDate}
            onChange={(event) => setMoveOutDate(event.target.value)}
          />
        </label>
        {amountInput("관리비 월액", "mgmtFeeMonthly", setMonthly)}
        {amountInput("관리비 일할", "mgmtFeeProrated")}
        {amountInput("수도 요금", "waterCharge")}
        {amountInput("전기 요금", "elecCharge")}
        {amountInput("가스 요금", "gasCharge")}

        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">전기 입금일</span>
          <Input
            aria-label="전기 입금일"
            type="date"
            value={value.elecPaidDate ?? ""}
            onChange={(event) => set("elecPaidDate", event.target.value)}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">가스 입금일</span>
          <Input
            aria-label="가스 입금일"
            type="date"
            value={value.gasPaidDate ?? ""}
            onChange={(event) => set("gasPaidDate", event.target.value)}
          />
        </label>

        {amountInput("수리비", "repairAmount")}
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">수리비 귀속</span>
          <Select
            aria-label="수리비 귀속"
            value={value.repairAttribution ?? ""}
            onChange={(event) =>
              set(
                "repairAttribution",
                event.target.value === ""
                  ? null
                  : (event.target.value as "owner" | "manager" | "office"),
              )
            }
            options={[
              { value: "", label: "선택 안 함" },
              { value: "owner", label: "건물주" },
              { value: "manager", label: "관리자" },
              { value: "office", label: "관리실" },
            ]}
          />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-bold text-t2">수리 메모</span>
          <Input
            aria-label="수리 메모"
            value={value.repairMemo ?? ""}
            onChange={(event) => set("repairMemo", event.target.value)}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">정산 은행</span>
          <Input
            aria-label="정산 은행"
            value={value.settleBank ?? ""}
            onChange={(event) => set("settleBank", event.target.value)}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">정산 계좌</span>
          <Input
            aria-label="정산 계좌"
            value={value.settleAcct ?? ""}
            onChange={(event) => set("settleAcct", event.target.value)}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">예금주</span>
          <Input
            aria-label="예금주"
            value={value.settleHolder ?? ""}
            onChange={(event) => set("settleHolder", event.target.value)}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">비고</span>
          <Input
            aria-label="비고"
            value={value.note ?? ""}
            onChange={(event) => set("note", event.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-bold text-t2">이사정산 적요</span>
          <Input
            aria-label="이사정산 적요"
            value={value.settlementNote ?? ""}
            onChange={(event) => set("settlementNote", event.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 rounded-xl bg-blue-t p-4 text-right">
        <span className="text-sm font-bold text-t2">정산금 </span>
        <strong className="text-xl text-blue-d">
          {amount.toLocaleString("ko-KR")}원
        </strong>
      </div>
    </section>
  );
}
