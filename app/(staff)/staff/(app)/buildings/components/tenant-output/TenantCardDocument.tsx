import type { Building } from "@/hooks/reactquery/buildings";
import type { TenantCardRow } from "@/hooks/reactquery/occupancies";

interface TenantCardDocumentProps {
  building: Building;
  tenant: TenantCardRow;
  companyName: string;
  year: number;
  month: number;
  pageIndex: number; // 0-based
  pageCount: number;
}

const CELL = "border border-[#c9ced4] px-[10px] py-[7px] align-middle";
const LABEL = `${CELL} w-[28%] bg-[#f4f6f8] text-[11px] font-bold text-[#4e5968]`;
const VALUE = `${CELL} text-[11.5px] text-[#191f28]`;

/** 단일 세대 입주자카드 A4 시트 — 미리보기와 인쇄에 공용으로 쓴다. */
export function TenantCardDocument({
  building,
  tenant,
  companyName,
  year,
  month,
  pageIndex,
  pageCount,
}: TenantCardDocumentProps) {
  const rows: [string, string][] = [
    ["호실명", tenant.unitNo],
    ["입주자명", tenant.isVacant ? "공실" : tenant.tenantName?.trim() || "-"],
    ["룸타입", tenant.roomTypeLabel ?? "-"],
    ["거주 인원", tenant.residentCount != null ? `${tenant.residentCount}명` : "-"],
    ["입주일", tenant.moveInDate ?? "-"],
    ["연락처", tenant.phone ?? "-"],
    ["공실 여부", tenant.isVacant ? "공실" : "입주"],
    ["연체 여부", tenant.isOverdue ? "연체" : "정상"],
  ];
  return (
    <div className="relative mx-auto min-h-[270mm] w-[190mm] overflow-hidden bg-white p-[16mm] text-[#191f28] shadow-sm print:break-after-page print:shadow-none">
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="rotate-[-24deg] whitespace-nowrap text-[68px] font-extrabold text-black/5">{companyName}</span>
      </div>
      <div className="relative">
        <h1 className="text-center text-[20px] font-extrabold tracking-[0.28em]">{"<< 입 주 자 카 드 >>"}</h1>
        <div className="mt-[10mm] space-y-[2mm] text-[12px] leading-[1.5]">
          <p>코드번호 : {building.code}</p>
          <p>빌라명칭 : {building.name}</p>
          <p>주소 : {building.address ?? "-"}</p>
        </div>
        <table className="mt-[6mm] w-full border-collapse">
          <tbody>
            {rows.map(([key, value]) => (
              <tr key={key}>
                <td className={LABEL}>{key}</td>
                <td className={VALUE}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-[12mm] text-center text-[11px] text-[#8b95a1]">
          {building.name} · {year}년 {month}월 기준 · {pageIndex + 1} / {pageCount} 쪽
        </p>
      </div>
    </div>
  );
}
