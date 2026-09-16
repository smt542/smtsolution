"use client";
import { useRouter } from "next/navigation";
import { EmptyState, Pagination, Spinner } from "@/components/common";
import type { BuildingDirectoryRow } from "@/hooks/reactquery/buildings";

const PAGE_SIZES = [10, 20, 50] as const;
const datePart = (value: string | null) => value?.slice(0, 10) ?? "";

interface Column {
  key: string;
  label: string;
  /** Cell text. */
  get?: (b: BuildingDirectoryRow) => string;
}

const BASE_COLUMNS: Column[] = [
  { key: "code", label: "코드", get: (b) => b.code ?? "" },
  { key: "name", label: "건물명", get: (b) => b.name ?? "" },
  { key: "type", label: "유형", get: (b) => b.typeLabel ?? "" },
  { key: "address", label: "주소", get: (b) => b.address ?? "" },
  { key: "ownerName", label: "건물주명", get: (b) => b.ownerName ?? "" },
  { key: "ownerPhone", label: "건물주 연락처", get: (b) => b.ownerPhone ?? "" },
  { key: "commonEntrance", label: "공동현관", get: (b) => b.commonEntrance ?? "" },
  { key: "manager", label: "관리", get: (b) => b.managerName ?? "" },
  { key: "meter", label: "검침", get: (b) => b.meterName ?? "" },
  { key: "cleaning", label: "청소", get: (b) => b.cleaningName ?? "" },
  { key: "createdAt", label: "등록일", get: (b) => datePart(b.createdAt) },
  { key: "action", label: "동작" },
];

/** Figma 673:39850 — 전체 건물 카드(선택형 마스터 테이블). 행 클릭 → 아래 입주민 표 로딩. */
export function BuildingDirectoryCard({
  rows,
  total,
  selectedId,
  onSelect,
  isLoading,
  isError,
  hasFilter,
  exportHref,
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  meterDayActive = false,
  meterDayByBuilding,
}: {
  rows: BuildingDirectoryRow[];
  total: number;
  selectedId: number | null;
  onSelect: (b: BuildingDirectoryRow) => void;
  isLoading: boolean;
  isError: boolean;
  hasFilter: boolean;
  exportHref: string;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  /** 검침일 필터 활성 시 조건부 검침일 컬럼을 노출한다. */
  meterDayActive?: boolean;
  meterDayByBuilding?: Record<number, number | null | undefined>;
}) {
  const router = useRouter();

  // 검침일 필터 활성 시 등록일 앞에 검침일 컬럼을 삽입.
  const columns: Column[] = meterDayActive
    ? BASE_COLUMNS.flatMap((c) => (c.key === "createdAt" ? [{ key: "mday", label: "검침일" }, c] : [c]))
    : BASE_COLUMNS;
  const meterDayText = (b: BuildingDirectoryRow) => {
    const d = meterDayByBuilding?.[b.id];
    return d == null ? "-" : `${d}일`;
  };

  return (
    <section className="shrink-0 overflow-hidden rounded-2xl bg-surface shadow-card">
      <header className="flex items-center gap-[10px] border-b border-line2 px-[18px] py-[15px]">
        <h2 className="text-[15px] font-extrabold leading-[normal] text-t1">전체 건물</h2>
        <span className="rounded-[7px] bg-bg px-[9px] py-[3px] text-[12px] font-bold leading-[1.4] text-t3">{total}곳</span>
        <div className="ml-auto flex items-center gap-[10px]">
          <a
            href={exportHref}
            className="inline-flex h-[40px] items-center rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold leading-[normal] text-t2 hover:bg-bg"
          >
            ⤓ 엑셀 다운
          </a>
          <button
            type="button"
            onClick={() => router.push("/staff/buildings/new")}
            className="inline-flex h-[40px] items-center rounded-[11px] border border-transparent bg-teal px-[15px] text-[13.5px] font-bold leading-[normal] text-white shadow-[0_6px_14px_-4px_rgba(20,164,151,0.5)] hover:bg-teal-d"
          >
            ＋ 건물 등록
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spinner />
        </div>
      ) : isError ? (
        <EmptyState message="데이터를 불러오지 못했습니다. 다시 시도해 주세요." />
      ) : rows.length === 0 ? (
        <EmptyState message={hasFilter ? "조건에 맞는 건물이 없습니다." : "등록된 건물이 없습니다."} />
      ) : (
        <>
          <div className="max-h-[230px] overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-[1]">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap border-b border-line bg-[#fbfcfd] px-[16px] py-[11px] text-[12px] font-bold leading-[normal] text-t3"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const selected = b.id === selectedId;
                  return (
                    <tr
                      key={b.id}
                      onClick={() => onSelect(b)}
                      aria-selected={selected}
                      className={`cursor-pointer border-b border-line2 last:border-0 ${
                        selected ? "bg-blue-t2" : "hover:bg-bg"
                      }`}
                    >
                      {columns.map((col) =>
                        col.key === "action" ? (
                          <td key={col.key} className="h-[55px] whitespace-nowrap px-[16px] leading-[normal]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/staff/buildings/${b.id}`);
                              }}
                              className="inline-flex h-[30px] items-center rounded-[11px] border border-line bg-surface px-[12px] text-[12.5px] font-bold leading-[normal] text-t2 hover:bg-bg"
                            >
                              상세
                            </button>
                          </td>
                        ) : col.key === "mday" ? (
                          <td key={col.key} className="h-[55px] whitespace-nowrap px-[16px] text-[13.5px] font-bold leading-[normal] text-t1">
                            {meterDayText(b)}
                          </td>
                        ) : (
                          <td key={col.key} className="h-[55px] whitespace-nowrap px-[16px] text-[13.5px] leading-[normal] text-t1">
                            {col.get?.(b) ?? ""}
                          </td>
                        ),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="border-t border-line2 px-[18px] py-[12px]">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={onPageChange}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZES}
                onPageSizeChange={onPageSizeChange}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
