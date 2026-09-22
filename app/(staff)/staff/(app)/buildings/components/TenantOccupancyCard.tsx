"use client";
import { useRouter } from "next/navigation";
import { EmptyState, Spinner } from "@/components/common";
import { MaskedPhone } from "@/components/common/MaskedPhone";
import type { TenantListRow } from "@/hooks/reactquery/occupancies";
import { TENANT_COLUMNS } from "./tenantColumns";
import { TenantEmptyState } from "./TenantEmptyState";

/**
 * Figma 673:40286 — 호수·입주민 카드(32컬럼 가로 스크롤).
 * 헤더(제목 + 엑셀/등록 버튼)는 항상 노출한다. 건물 미선택 시 제목은 "입주민",
 * 액션 버튼은 비활성(muted), 본문은 "건물을 선택해 주세요" 빈 상태.
 * 입주민 행 클릭/Enter → 해당 세대의 입주민 관리카드 모달.
 */
export function TenantOccupancyCard({
  buildingId,
  buildingName,
  rows,
  isLoading,
  isError,
  onOpenManagementCard,
}: {
  buildingId: number | null;
  buildingName: string | null;
  rows: TenantListRow[];
  isLoading: boolean;
  isError: boolean;
  onOpenManagementCard: (tenant: TenantListRow) => void;
}) {
  const router = useRouter();
  const selected = buildingId != null && buildingName != null;
  const base = selected ? `/staff/buildings/${buildingId}/tenants` : "";
  const occupiedCount = rows.filter((row) => !row.isVacant).length;

  return (
    <section className="flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
      <header className="flex shrink-0 items-center gap-[10px] border-b border-line2 px-[18px] py-[15px]">
        <h2 className="text-[15px] font-extrabold leading-[normal] text-t1">
          {selected ? `${buildingName} 호수·입주민` : "입주민"}
        </h2>
        {selected && (
          <span className="rounded-[7px] bg-bg px-[9px] py-[3px] text-[12px] font-bold leading-[1.4] text-t3">{occupiedCount}명</span>
        )}
        <div className="ml-auto flex items-center gap-[10px]">
          <a
            href={selected ? `/api/buildings/${buildingId}/tenant-cards` : undefined}
            aria-disabled={!selected}
            onClick={(event) => {
              if (!selected) event.preventDefault();
            }}
            className={`inline-flex h-[40px] items-center rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold leading-[normal] text-t2 hover:bg-bg ${
              selected ? "" : "cursor-default opacity-[.45] hover:bg-surface"
            }`}
          >
            ⤓ 엑셀 다운
          </a>
          <button
            type="button"
            disabled={!selected}
            title={selected ? undefined : "건물을 먼저 선택해 주세요"}
            onClick={() => router.push(`${base}/new`)}
            className="inline-flex h-[40px] items-center rounded-[11px] border border-transparent bg-teal px-[15px] text-[13.5px] font-bold leading-[normal] text-white shadow-[0_6px_14px_-4px_rgba(20,164,151,0.5)] hover:bg-teal-d disabled:cursor-default disabled:opacity-[.45] disabled:shadow-none disabled:hover:bg-teal"
          >
            ＋ 호수·입주민 등록
          </button>
        </div>
      </header>

      {!selected ? (
        <TenantEmptyState />
      ) : isLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : isError ? (
        <EmptyState message="데이터를 불러오지 못했습니다. 다시 시도해 주세요." />
      ) : rows.length === 0 ? (
        <EmptyState message="등록된 세대가 없습니다." />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="border-collapse text-left">
            <thead className="sticky top-0 z-[1]">
              <tr>
                {TENANT_COLUMNS.map((col) => (
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
              {rows.map((t) => (
                <tr
                  key={t.unitId}
                  tabIndex={0}
                  aria-label={`${t.unitNo}호 ${t.isVacant ? "공실" : (t.tenantName?.trim() || "입주자 미등록")} 입주민 관리카드 보기`}
                  onClick={() => onOpenManagementCard(t)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    onOpenManagementCard(t);
                  }}
                  className="cursor-pointer border-b border-line2 outline-none last:border-0 hover:bg-bg focus-visible:bg-teal-t focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal"
                >
                  {TENANT_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className="whitespace-nowrap px-[16px] py-[12px] text-[13.5px] leading-[normal] text-t1"
                    >
                      {col.key === "phone" && t.phone ? (
                        t.occupancyId ? (
                          <MaskedPhone
                            value={t.phone}
                            kind="phone"
                            alreadyMasked
                            reveal={{ targetKind: "occupancy", targetId: t.occupancyId, field: "phone" }}
                          />
                        ) : (
                          "-"
                        )
                      ) : (
                        col.get(t)
                      )}
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
