import type { CustomerNumberLookupKind } from "@/hooks/reactquery/buildingCustomerNumbers";

const KIND_OPTIONS: { value: CustomerNumberLookupKind; label: string }[] = [
  { value: "water", label: "수도" },
  { value: "common_elec", label: "공용전기" },
];

export function CustomerNumberLookupHeader({
  kind,
  total,
  onKindChange,
}: {
  kind: CustomerNumberLookupKind;
  total: number;
  onKindChange: (kind: CustomerNumberLookupKind) => void;
}) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-[10px] border-b border-line2 px-[18px] py-[15px]">
      <div
        className="inline-flex flex-none gap-[2px] rounded-[10px] bg-[#EDF0F3] p-[3px]"
        role="group"
        aria-label="공과금 종류"
      >
        {KIND_OPTIONS.map((option) => {
          const selected = kind === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              className={`cursor-pointer rounded-[8px] px-[13px] py-[6px] text-[13px] font-bold transition-colors ${
                selected
                  ? "bg-white text-t1 shadow-[0_2px_3px_rgba(23,31,40,0.1)]"
                  : "text-t3 hover:text-t1"
              }`}
              onClick={() => onKindChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <span
        aria-label={`조회 결과 ${total.toLocaleString("ko-KR")}건`}
        className="ml-auto text-[12.5px] font-semibold text-t3"
      >
        <b className="num font-bold text-t1">{total.toLocaleString("ko-KR")}</b>건
      </span>
    </div>
  );
}
