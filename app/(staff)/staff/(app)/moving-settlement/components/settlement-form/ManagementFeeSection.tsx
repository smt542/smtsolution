import { formatNumber } from "@/lib/format";

const LEFT_ITEMS = [
  ["공용수도료", ["일할", "4사5입"]],
  ["TV수신료", ["일할", "4사5입"]],
  ["승강기검사", ["4사5입"]],
  ["전기안전관리", ["4사5입"]],
  ["유선및인터넷", ["일할", "4사5입"]],
  ["청소비", ["일할", "4사5입"]],
  ["감면", ["그대로"]],
  ["전월과오납", ["그대로"]],
] as const;

const RIGHT_ITEMS = [
  ["공용전기료", ["일할", "4사5입"]],
  ["정화조/스크린", ["절하"]],
  ["승강기유지비", ["4사5입"]],
  ["시설물유지비", ["일할", "4사5입"]],
  ["소방안전관리", ["4사5입"]],
  ["음식물수거비", ["일할", "4사5입"]],
  ["수리비", ["그대로"]],
  ["수선충당금", ["4사5입"]],
] as const;

function numericValue(raw: string): number | null {
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function Badges({ values }: { values: readonly string[] }) {
  return (
    <span className="inline-flex shrink-0">
      {values.map((value) => {
        const isMethod = value === "일할" || value === "월할";
        return (
          <span
            key={value}
            className={`${isMethod ? "border-line bg-white" : "border-line2 bg-[#f2f4f6]"} rounded-[5px] border px-[6px] py-[2px] text-[10.5px] font-extrabold text-t3`}
          >
            {value}
          </span>
        );
      })}
    </span>
  );
}

export function ManagementFeeSection({
  monthly,
  prorated,
  contactPhone,
  onMonthlyChange,
  onProratedChange,
}: {
  monthly: number | null;
  prorated: number | null;
  contactPhone?: string;
  onMonthlyChange: (amount: number | null) => void;
  onProratedChange: (amount: number | null) => void;
}) {
  return (
    <section className="rounded-[14px] border border-[#dce1e7] bg-white px-[16px] pb-[16px] pt-[15px]">
      <div className="flex h-[18px] items-center pb-px">
        <h3 className="text-[14px] font-extrabold leading-[17px] text-t1">관리비 항목</h3>
        <span className="ml-auto text-right text-[11.5px] font-semibold text-t3">부과액 / 정산액(일할 자동)</span>
      </div>
      <div className="mt-[10px] grid grid-cols-2 gap-x-[16px]">
        <div className="grid gap-y-[7px]">
          <div className="grid h-[34px] grid-cols-[1fr_88px_88px] items-center gap-[7px]">
            <span className="flex h-[19px] min-w-0 items-center gap-[5px] overflow-hidden">
              <span className="truncate text-[12.5px] font-semibold text-t1">일반관리비</span>
              <Badges values={["일할", "절상"]} />
            </span>
            <input
              aria-label="관리비 월액"
              type="number"
              min={0}
              value={monthly ?? ""}
              onChange={(event) => onMonthlyChange(numericValue(event.target.value))}
              className="h-[34px] rounded-[9px] border border-[#dee3e8] bg-white px-[9px] text-right text-[12.5px] font-semibold text-t1 outline-none focus:border-teal"
            />
            <input
              aria-label="관리비 일할"
              type="number"
              min={0}
              value={prorated ?? ""}
              onChange={(event) => onProratedChange(numericValue(event.target.value))}
              className="h-[34px] rounded-[9px] border border-line2 bg-[#f7f9fa] px-[9px] text-right text-[12.5px] font-semibold text-t2 outline-none focus:border-teal"
            />
          </div>
          {LEFT_ITEMS.map(([label, badges]) => (
            <div key={label} className="grid h-[34px] grid-cols-[1fr_88px_88px] items-center gap-[7px]">
              <span className="flex h-[19px] min-w-0 items-center gap-[5px] overflow-hidden">
                <span className="truncate text-[12.5px] font-semibold text-t1">{label}</span>
                <Badges values={badges} />
              </span>
              <span className="flex h-[34px] items-center justify-end rounded-[9px] border border-[#dee3e8] px-[9px] text-right text-[12.5px] font-semibold text-t1">0</span>
              <span className="flex h-[34px] items-center justify-end rounded-[9px] border border-line2 bg-[#f7f9fa] px-[9px] text-right text-[12.5px] font-semibold text-t2">0</span>
            </div>
          ))}
        </div>
        <div className="grid content-start gap-y-[7px]">
          {RIGHT_ITEMS.map(([label, badges]) => (
            <div key={label} className="grid h-[34px] grid-cols-[1fr_88px_88px] items-center gap-[7px]">
              <span className="flex h-[19px] min-w-0 items-center gap-[5px] overflow-hidden">
                <span className="truncate text-[12.5px] font-semibold text-t1">{label}</span>
                <Badges values={badges} />
              </span>
              <span className="flex h-[34px] items-center justify-end rounded-[9px] border border-[#dee3e8] px-[9px] text-right text-[12.5px] font-semibold text-t1">0</span>
              <span className="flex h-[34px] items-center justify-end rounded-[9px] border border-line2 bg-[#f7f9fa] px-[9px] text-right text-[12.5px] font-semibold text-t2">0</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-[10px] grid grid-cols-2 gap-[11px]">
        <label>
          <span className="mb-[6px] block h-[14px] text-[12px] font-bold leading-[14px] text-t2">가수금</span>
          <input
            aria-label="가수금"
            type="number"
            min={0}
            defaultValue={0}
            className="h-[38px] w-full rounded-[10px] border border-[#dee3e8] bg-white px-[11px] text-right text-[13.5px] font-semibold text-t1 outline-none focus:border-teal"
          />
        </label>
        <label>
          <span className="mb-[6px] block h-[14px] text-[12px] font-bold leading-[14px] text-t2">연락처</span>
          <input
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
        <strong className="ml-[10px] text-[17px] font-extrabold leading-[20px] tracking-[-0.17px] text-teal-d">{formatNumber(prorated ?? 0)}</strong>
        <span className="ml-[3px] text-[12px] font-bold leading-[20px] text-teal-d opacity-[0.62]">원</span>
      </div>
    </section>
  );
}
