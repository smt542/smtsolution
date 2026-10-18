import { Input } from "@/components/common";
import { formatNumber } from "@/lib/format";
import { type FeeItem } from "@/hooks/reactquery/feeItems";
import { useManagementFeeRows } from "@/hooks/reactquery/movingSettlement/feeItemCharges";
import { type Rounding } from "@/lib/billing/proration";

const ROUNDING_LABELS: Record<Rounding, string> = {
  round: "4사5입",
  up: "절상",
  down: "절하",
  raw: "그대로",
};

function Badge({
  kind,
  label,
}: {
  kind: "method" | "rounding";
  label: string;
}) {
  const isMethod = kind === "method";

  return (
    <span
      className={`${isMethod ? "border-line bg-white" : "border-line2 bg-[#f2f4f6]"} rounded-[5px] border px-[6px] py-[2px] text-[10.5px] font-extrabold leading-[13px] text-t3`}
    >
      {label}
    </span>
  );
}

function Badges({ item }: { item: FeeItem }) {
  const rounding = item.rounding as Rounding;

  return (
    <span className="inline-flex shrink-0 gap-[5px]">
      {item.dailyProration === true && <Badge kind="method" label="일할" />}
      <Badge kind="rounding" label={ROUNDING_LABELS[rounding]} />
    </span>
  );
}

function FeeItemRow({
  item,
  charge,
  settlement,
  onChargeChange,
}: {
  item: FeeItem;
  charge: number;
  settlement: number;
  onChargeChange: (name: string, amount: number) => void;
}) {
  return (
    <div className="grid h-[34px] grid-cols-[1fr_88px_88px] items-center gap-[7px]">
      <span className="flex h-[19px] min-w-0 items-center gap-[5px] overflow-hidden">
        <span className="truncate text-[12.5px] font-semibold text-t1">{item.name}</span>
        <Badges item={item} />
      </span>
      {/* 부과액은 공과금 지침처럼 직접 고칠 수 있다(2026-10-18). 정산액은 고친 부과액으로 일할 다시 계산. */}
      <Input
        unstyled
        aria-label={`${item.name} 부과액`}
        type="number"
        min={0}
        step={1}
        value={charge}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChargeChange(item.name, event.target.value === "" || !Number.isFinite(parsed) ? 0 : Math.max(0, Math.round(parsed)));
        }}
        className="h-[34px] w-full rounded-[9px] border border-[#dee3e8] px-[9px] text-right text-[12.5px] font-semibold text-t1 outline-none focus:border-teal"
      />
      <span className="flex h-[34px] items-center justify-end rounded-[9px] border border-line2 bg-[#f7f9fa] px-[9px] text-right text-[12.5px] font-semibold text-t2">
        {formatNumber(settlement)}
      </span>
    </div>
  );
}

type ManagementFeeSectionProps = {
  buildingTypeId: number | null;
  unitId: number | null;
  moveOutDate: string;
  monthly?: number | null;
  prorated?: number | null;
  contactPhone?: string;
  /** 가수금(extra.adv, 0302). */
  advance?: number | null;
  /** 항목명 → 직접 입력한 부과액. */
  feeCharges?: Record<string, number>;
  onFeeChargeChange?: (name: string, amount: number) => void;
  onAdvanceChange?: (amount: number | null) => void;
  onMonthlyChange?: (amount: number | null) => void;
  onProratedChange?: (amount: number | null) => void;
};

export function ManagementFeeSection({
  buildingTypeId,
  unitId,
  moveOutDate,
  contactPhone,
  advance = null,
  onAdvanceChange = () => undefined,
  feeCharges,
  onFeeChargeChange = () => undefined,
}: ManagementFeeSectionProps) {
  const { rows, subtotal, isLoading } = useManagementFeeRows(
    buildingTypeId,
    unitId,
    moveOutDate,
    feeCharges,
  );
  const leftRows = rows.filter((_, index) => index % 2 === 0);
  const rightRows = rows.filter((_, index) => index % 2 === 1);

  return (
    <section className="rounded-[14px] border border-[#dce1e7] bg-white px-[16px] pb-[16px] pt-[15px]">
      <div className="flex h-[18px] items-center pb-px">
        <h3 className="text-[14px] font-extrabold leading-[17px] text-t1">관리비 항목</h3>
        <span className="ml-auto text-right text-[11.5px] font-semibold leading-[14px] text-t3">부과액 / 정산액(일할 자동)</span>
      </div>
      {isLoading ? (
        <p className="mt-[10px] text-[12.5px] text-t4">관리비 항목을 불러오고 있어요</p>
      ) : rows.length === 0 ? (
        <p className="mt-[10px] text-[12.5px] text-t4">등록된 관리비 항목이 없어요</p>
      ) : (
        <div className="mt-[10px] grid grid-cols-2 gap-x-[16px]">
          <div className="grid gap-y-[7px]">
            {leftRows.map((row) => (
              <FeeItemRow key={row.item.id} {...row} onChargeChange={onFeeChargeChange} />
            ))}
          </div>
          <div className="grid content-start gap-y-[7px]">
            {rightRows.map((row) => (
              <FeeItemRow key={row.item.id} {...row} onChargeChange={onFeeChargeChange} />
            ))}
          </div>
        </div>
      )}
      <div className="mt-[10px] grid grid-cols-2 gap-[11px]">
        <label>
          <span className="mb-[6px] block h-[14px] text-[12px] font-bold leading-[14px] text-t2">가수금</span>
          <Input
            unstyled
            aria-label="가수금"
            type="number"
            min={0}
            value={advance ?? 0}
            onChange={(event) => {
              const raw = event.target.value;
              const parsed = Number(raw);
              onAdvanceChange(raw === "" || !Number.isFinite(parsed) ? null : parsed);
            }}
            className="h-[38px] w-full rounded-[10px] border border-[#dee3e8] bg-white px-[11px] text-right text-[13.5px] font-semibold text-t1 outline-none focus:border-teal"
          />
        </label>
        <label>
          <span className="mb-[6px] block h-[14px] text-[12px] font-bold leading-[14px] text-t2">연락처</span>
          <Input
            unstyled
            aria-label="연락처"
            value={contactPhone ?? ""}
            readOnly
            placeholder="010-0000-0000"
            className="h-[38px] w-full rounded-[10px] border border-[#dee3e8] bg-white px-[11px] text-[13.5px] font-semibold text-t1 outline-none placeholder:font-medium placeholder:text-[13px] placeholder:text-t4 focus:border-teal"
          />
        </label>
      </div>
      <div className="mt-[10px] flex h-[32px] items-baseline justify-center border-t border-line pt-[11px]">
        <span className="text-[14px] font-medium leading-[20px] text-t1">② 관리비 소계</span>
        <strong className="ml-[10px] text-[17px] font-extrabold leading-[21px] tracking-[-0.17px] text-teal-d">{formatNumber(subtotal + (advance ?? 0))}</strong>
        <span className="ml-[3px] text-[12px] font-bold leading-[15px] text-teal-d opacity-[0.62]">원</span>
      </div>
    </section>
  );
}
