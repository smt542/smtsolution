"use client";

import type { BillDocument, BillTarget } from "@/hooks/reactquery/bill";
import type { BillBuilding } from "../../types";
import { ZoomControls } from "./OutputModalPrimitives";

interface CompactDocumentPreviewProps {
  type: "giro" | "adjustment" | "fax";
  companyName: string;
  period: string;
  building?: BillBuilding;
  target?: BillTarget;
  document?: BillDocument;
  zoom: number;
  onZoom: (value: number) => void;
}

const feeNames = ["일반관리비", "청소비", "승강기유지비", "전기료", "수도료", "공용전기료", "장기수선충당금"];

function amount(value: number | undefined) {
  return (value ?? 0).toLocaleString("ko-KR");
}

function unitLabel(unitNo: string | undefined) {
  if (!unitNo) return "-";
  return unitNo.endsWith("호") ? unitNo : `${unitNo}호`;
}

function GiroPaper({ companyName, period, building, target, document }: Omit<CompactDocumentPreviewProps, "type" | "zoom" | "onZoom">) {
  const [year, month] = period.split("-");
  const total = document?.totalAmount ?? target?.totalAmount ?? 0;
  const rows = document?.items?.slice(0, 8) ?? feeNames.map((name) => ({ name, amount: 0 }));

  return (
    <div className="relative h-[464px] w-[628px] overflow-hidden border border-[#c5cbd1] bg-white text-[#20262d] shadow-[0_2px_7px_rgba(23,31,40,0.1)]">
      <div className="absolute left-[88px] top-[48px] text-[9px] leading-[12px]"><p>{building?.address ?? "-"}</p><p>{building?.name ?? "-"} {unitLabel(target?.unitNo)}</p></div>
      <p className="absolute left-[23px] top-[198px] text-[7px]">농협 352-2224-0507-03　{companyName}</p>
      <div className="absolute left-[4px] top-[260px] w-[294px]">
        <div className="flex items-end justify-between px-[17px] pb-[6px] text-[7px] leading-[11px]"><span>{building?.name ?? "-"} {unitLabel(target?.unitNo)}<br />{target?.payerName || target?.tenantName || ""}</span><span className="text-right">{year}　 {month}<br /><strong className="text-[9px]">{amount(total)}</strong></span></div>
        <div className="grid grid-cols-[77px_72px_72px_72px] border-l border-t border-black text-[6px] leading-[10px]">
          {(["항목", "당월", "전월", "금액"] as const).map((label) => <strong key={label} className="border-b border-r border-black text-center">{label}</strong>)}
          {rows.slice(0, 7).map((row, index) => <div key={`${row.name}-${index}`} className="contents"><span className="border-b border-r border-black px-1">{row.name}</span><span className="border-b border-r border-black text-center">-</span><span className="border-b border-r border-black text-center">-</span><span className="border-b border-r border-black px-1 text-right">{amount(row.amount)}</span></div>)}
        </div>
      </div>
      <div className="absolute left-[405px] top-[205px] w-[206px] text-[6px] leading-[10px]"><p className="font-bold">●●●●● 꼭 읽어주세요 ●●●●●</p><p>납기일을 확인해 주세요.</p><p>문의사항은 관리사무소로 연락 바랍니다.</p><p>자동이체 세대는 별도 출금됩니다.</p></div>
      <div className="absolute left-[405px] top-[382px] grid w-[214px] grid-cols-5 border-l border-t border-black text-[4.5px] leading-[10px]">{["구분", "전기", "수도", "당월", "전월", ...Array.from({ length: 20 }, (_, index) => index % 5 === 0 ? `${year}.${String(Number(month) - Math.floor(index / 5)).padStart(2, "0")}` : String((index * 3) % 11))].map((value, index) => <span key={index} className="border-b border-r border-black text-center">{value}</span>)}</div>
      <div className="absolute left-[8px] top-[448px] h-px w-[611px] bg-black" />
    </div>
  );
}

function AdjustmentPaper({ period, building, target }: Omit<CompactDocumentPreviewProps, "type" | "zoom" | "onZoom">) {
  const [year, month] = period.split("-");
  const headers = ["순번", "호수", "성명", "전기", "수도", "일반관리", "청소비", "승강기", "공용전기", "수선충당", "당월계", "전월계", "증감"];
  return (
    <div className="h-[435px] w-[616px] overflow-hidden border border-[#c5cbd1] bg-white px-[16px] text-[#20262d] shadow-[0_2px_7px_rgba(23,31,40,0.1)]">
      <div className="text-center">
        <strong className="text-[5px] tracking-[1px]">[ {year}년 {Number(month)}월분 조정명세서 ]</strong>
        <p className="text-[3.5px]">[ {building?.code ?? "001"} {building?.name ?? "-"} ]</p>
      </div>
      <div className="grid grid-cols-[20px_31px_38px_repeat(10,minmax(0,1fr))] border-l border-t border-black text-[1.5px] leading-[2px]">
        {headers.map((label) => <strong key={label} className="truncate border-b border-r border-black text-center">{label}</strong>)}
        {Array.from({ length: 20 }, (_, index) => headers.map((_, column) => column === 0 ? String(index + 1) : column === 1 ? `${Math.floor(index / 5) + 1}0${index % 5 + 1}` : column === 2 ? (index === 0 ? target?.payerName || target?.tenantName || "김민수" : "") : column > 9 ? String(267000 + index * 1320) : String((index + 2) * (column + 3) * 110))).flat().map((value, index) => <span key={index} className="truncate border-b border-r border-black px-px text-right">{value}</span>)}
      </div>
    </div>
  );
}

export function CompactDocumentPreview(props: CompactDocumentPreviewProps) {
  const { type, zoom, onZoom } = props;
  return (
    <section className="relative flex min-h-0 flex-1 items-start justify-start overflow-hidden bg-[#e9edf1] pl-[17px] pt-[17px]">
      {type === "fax" && (
        <div className="absolute left-[17px] top-[14px] z-10 flex gap-[6px]">
          {["재발행", "단수", "자동이체"].map((label) => (
            <span key={label} className="rounded-[7px] border border-[#dfe3e7] bg-white px-[9px] py-[5px] text-[9.5px] font-bold text-[#6b7684] shadow-sm">{label}</span>
          ))}
        </div>
      )}
      <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}>
        {type === "adjustment" ? <AdjustmentPaper {...props} /> : <GiroPaper {...props} />}
      </div>
      <ZoomControls zoom={zoom} onZoom={onZoom} />
    </section>
  );
}
