import { Button } from "@/components/common";
import { SearchIcon } from "@/components/icons";
import type { CustomerNumberLookupKind } from "@/hooks/reactquery/buildingCustomerNumbers";

const KIND_OPTIONS: { value: CustomerNumberLookupKind; label: string }[] = [
  { value: "water", label: "수도" },
  { value: "common_elec", label: "공용전기" },
];

export function CustomerNumberLookupToolbar({
  kind,
  total,
  query,
  onKindChange,
  onQueryChange,
  onExport,
}: {
  kind: CustomerNumberLookupKind;
  total: number;
  query: string;
  onKindChange: (kind: CustomerNumberLookupKind) => void;
  onQueryChange: (query: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div
          className="flex h-10 rounded-lg bg-bg p-1"
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
                className={`min-w-[76px] rounded-md px-4 text-sm font-bold transition ${
                  selected
                    ? "bg-teal text-white shadow-sm"
                    : "text-t3 hover:bg-white hover:text-t1"
                }`}
                onClick={() => onKindChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <span className="text-sm font-semibold text-t3">
          조회 결과 <strong className="num text-teal">{total.toLocaleString("ko-KR")}</strong>건
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
        <label className="relative min-w-0 flex-1 sm:w-[330px] sm:flex-none">
          <span className="sr-only">고객번호 통합검색</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t4" />
          <input
            type="search"
            aria-label="고객번호 통합검색"
            className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm text-t1 outline-none transition placeholder:text-t4 focus:border-teal focus:ring-2 focus:ring-teal/10"
            placeholder="고객번호, 빌라명, 주소, 구분, 적요 검색"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <Button type="button" variant="ghost" className="h-10 shrink-0 rounded-lg" onClick={onExport}>
          엑셀 다운로드
        </Button>
      </div>
    </div>
  );
}
