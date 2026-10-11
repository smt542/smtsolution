import { SearchBar } from "@/components/common";
import type { CustomerNumberLookupKind } from "@/hooks/reactquery/buildingCustomerNumbers";

const KIND_OPTIONS: { value: CustomerNumberLookupKind; label: string }[] = [
  { value: "water", label: "수도" },
  { value: "common_elec", label: "공용전기" },
];

export function CustomerNumberLookupHeader({
  kind,
  total,
  search,
  exportHref,
  onKindChange,
  onSearchChange,
}: {
  kind: CustomerNumberLookupKind;
  total: number;
  search: string;
  exportHref: string;
  onKindChange: (kind: CustomerNumberLookupKind) => void;
  onSearchChange: (value: string) => void;
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
              className={`cursor-pointer rounded-[8px] px-[13px] py-[6px] text-[13px] font-bold leading-[normal] transition-colors ${
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

      <div className="min-w-[220px] max-w-[320px] flex-1">
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder="고객번호·건물명·주소·구분·LIN·적요 검색"
        />
      </div>

      <span
        aria-label={`조회 결과 ${total.toLocaleString("ko-KR")}건`}
        className="ml-auto text-[12.5px] font-semibold leading-[normal] text-t3"
      >
        <b className="num font-bold text-t1">{total.toLocaleString("ko-KR")}</b>건
      </span>

      <a
        href={exportHref}
        className="inline-flex h-[40px] items-center rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold leading-[normal] text-t2 hover:bg-bg"
      >
        ⤓ 엑셀 다운
      </a>
    </div>
  );
}
