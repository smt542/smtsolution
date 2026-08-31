"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common";
import type { TenantListRow } from "@/hooks/reactquery/occupancies";
import { TENANT_COLUMNS, TENANT_TABLE_MIN_WIDTH } from "./tenantColumns";
import { TenantEmptyState } from "./TenantEmptyState";

/**
 * Figma 673:40286 — 호수·입주민 카드(33컬럼 가로 스크롤).
 * 헤더(제목 + 엑셀/등록 버튼)는 항상 노출한다. 건물 미선택 시 제목은 "입주민",
 * 액션 버튼은 비활성(muted), 본문은 "건물을 선택해 주세요" 빈 상태.
 */
export function TenantOccupancyCard({
  buildingId,
  buildingName,
  rows,
  isLoading,
  isError,
}: {
  buildingId: number | null;
  buildingName: string | null;
  rows: TenantListRow[];
  isLoading: boolean;
  isError: boolean;
}) {
  const router = useRouter();
  const selected = buildingId != null && buildingName != null;
  const base = selected ? `/staff/buildings/${buildingId}/tenants` : "";

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex items-center gap-[10px] border-b border-line2 px-[18px] py-[15px]">
        <h2 className="text-[15px] font-extrabold text-t1">
          {selected ? `${buildingName} 호수·입주민` : "입주민"}
        </h2>
        {selected && (
          <span className="rounded-[7px] bg-bg px-[9px] py-[3px] text-[12px] font-bold text-t3">{rows.length}명</span>
        )}
        <div className="ml-auto flex items-center gap-[8px]">
          <button
            type="button"
            disabled={!selected}
            onClick={() => toast("엑셀 다운로드는 준비 중입니다.")}
            className="inline-flex h-[40px] items-center rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold text-t2 hover:bg-bg disabled:cursor-default disabled:opacity-50 disabled:hover:bg-surface"
          >
            ⤓ 엑셀 다운
          </button>
          <button
            type="button"
            disabled={!selected}
            title={selected ? undefined : "건물을 먼저 선택해 주세요"}
            onClick={() => router.push(`${base}/new`)}
            className="inline-flex h-[40px] items-center rounded-[11px] bg-teal px-[15px] text-[13.5px] font-bold text-white shadow-[0_6px_7px_rgba(20,164,151,0.5)] hover:bg-teal-d disabled:cursor-default disabled:opacity-50 disabled:shadow-none disabled:hover:bg-teal"
          >
            ＋ 호수·입주민 등록
          </button>
        </div>
      </header>

      {!selected ? (
        <TenantEmptyState />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <EmptyState message="데이터를 불러오지 못했습니다. 다시 시도해 주세요." />
      ) : rows.length === 0 ? (
        <EmptyState message="등록된 세대가 없습니다." />
      ) : (
        <div className="max-h-[440px] overflow-auto">
          <table className="border-collapse text-left" style={{ minWidth: TENANT_TABLE_MIN_WIDTH }}>
            <thead className="sticky top-0 z-[1]">
              <tr>
                {TENANT_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    style={{ minWidth: col.w }}
                    className="h-[36px] whitespace-nowrap border-b border-line bg-[#fbfcfd] px-[16px] text-[12px] font-bold text-t3"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.unitId}
                  onDoubleClick={() => router.push(`${base}/${t.unitId}`)}
                  className="h-[41px] cursor-pointer border-b border-line2 last:border-0 hover:bg-bg"
                >
                  {TENANT_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      style={{ minWidth: col.w }}
                      className="whitespace-nowrap px-[16px] text-[13.5px] text-t1"
                    >
                      {col.get(t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
