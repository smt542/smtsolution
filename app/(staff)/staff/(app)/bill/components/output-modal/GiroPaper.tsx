"use client";

import type { BillDocument, BillTarget } from "@/hooks/reactquery/bill";
import { displayUnitNo, type PrintableAccount } from "@/lib/bill/document";
import type { BillBuilding } from "../../types";
import type { GiroStampOptions } from "../GiroPrintView";
import { GiroStampOverlays } from "./GiroStampOverlays";

/** 자연 크기 = A4 @96dpi. 미리보기는 0.796배로 축소해 Figma 표시 크기(632×894)와 맞춘다. */
export const GIRO_PAPER_WIDTH = 794;
export const GIRO_PAPER_HEIGHT = 1123;

export interface GiroPaperProps {
  companyName: string;
  period: string;
  building?: BillBuilding;
  target?: BillTarget;
  document?: BillDocument;
  accounts: PrintableAccount[];
  customerNotice: string | null;
  dueDate: string | null;
  stamps?: GiroStampOptions;
  /** 도장 적용 대상 표시(청록 테두리). 개별 범위에서는 클릭한 1장만 true. */
  highlighted?: boolean;
}

const DEFAULT_NOTICE = [
  "●●●●●필독 안내문●●●●●",
  "▶변기에 물티슈, 음식물등을 이물질 넣으면 막혀서 역류합니다.",
  "▶흡연금연!!! 실내흡연시 흡연으로인한 도배, 가구, 니코틴제거를 원상복구비 청구됩니다.",
  "▶수도감면대상:관할 주민센터로 신청후 관리업체로 연락주셔야 감면받으실수 있습니다(기초수급자, 다자녀)",
  "▶연락처 변경된 세대는 관리실로 연락바랍니다, 미고지로 인한 불이익은 책임지지 않습",
];

const PAPER_TEXT = "font-['Malgun_Gothic'] text-black";
const CELL = "flex min-w-0 items-center overflow-clip border-b border-r border-black px-[2px]";

function amount(value: number) {
  return value.toLocaleString("ko-KR");
}

function dueDateParts(dueDate: string | null) {
  const match = dueDate?.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? { year: match[1], month: match[2], day: match[3] } : null;
}

function shortDueDate(dueDate: string | null) {
  const parts = dueDateParts(dueDate);
  return parts ? `${parts.month}월 ${parts.day}일` : "";
}

function longDueDate(dueDate: string | null) {
  const parts = dueDateParts(dueDate);
  return parts ? `${parts.year} 년 ${parts.month}월 ${parts.day}일` : "";
}

function accountLine(accounts: PrintableAccount[], companyName: string) {
  return accounts
    .map((account) => [account.bank, account.acct, companyName].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" / ");
}

export function GiroPaper({ companyName, period, building, target, document, accounts, customerNotice, dueDate, stamps, highlighted = false }: GiroPaperProps) {
  const [year = "", month = ""] = period.split("-");
  const total = document?.totalAmount ?? target?.totalAmount ?? 0;
  const unit = displayUnitNo(target?.unitNo ?? document?.unitNo);
  const unitId = document?.unitId ?? target?.unitId;
  const showReissue = stamps?.reissueUnitIds.includes(unitId ?? -1) ?? false;
  const showWaterCutoff = stamps?.waterCutoffUnitIds.includes(unitId ?? -1) ?? false;
  const showAutoDebit = stamps?.autoDebitUnitIds.includes(unitId ?? -1) ?? false;
  const chargedItems = (document?.items ?? []).filter((item) => item.charged).slice(0, 5);
  const noticeLines = customerNotice?.trim() ? customerNotice.split(/\r?\n/) : DEFAULT_NOTICE;

  const feeCells: { value: string; className?: string; strong?: boolean }[] = [
    ...["항목", "당월", "전월", "량", "", "금 액", "할인액", "부 과 액"].map((value) => ({ value, strong: true, className: "justify-center text-center" })),
    ...Array.from({ length: 5 }, (_, index) => {
      const item = chargedItems[index];
      return [
        { value: item?.name ?? "", className: "justify-start" },
        { value: "", className: "justify-end text-right" },
        { value: "", className: "justify-end text-right" },
        { value: "", className: "justify-end text-right" },
        { value: "", className: "justify-end text-right" },
        { value: "", className: "justify-end text-right" },
        { value: "", className: "justify-end text-right" },
        { value: item ? amount(item.amount) : "", className: "justify-end text-right" },
      ];
    }).flat(),
    ...["당 월 계", "미 납 액", "납기내금액", "납기후연체", "납기후금액"].map((label, index) => [
      { value: "", className: "justify-center text-center" },
      { value: "", className: "justify-center text-center" },
      { value: "", className: "justify-center text-center" },
      { value: "", className: "justify-center text-center" },
      { value: "", className: "justify-center text-center" },
      { value: label, className: "col-span-2 justify-center text-center", strong: true },
      { value: index === 0 || index === 2 ? amount(total) : "", className: "justify-end text-right", strong: true },
    ]).flat(),
  ];

  // 사용량 추이는 당월부터 거슬러 5개월. 월 라벨만 period에서 유도하고 수치는 데이터가 없어 비워 둔다.
  const trendMonths = Array.from({ length: 5 }, (_, index) => {
    const base = new Date(Number(year), Number(month) - 1 - index, 1);
    return `${base.getFullYear()}.${String(base.getMonth() + 1).padStart(2, "0")}`;
  });
  const trendCells = [
    { value: "구분", className: "row-span-2 justify-center text-center" },
    { value: "전   기", className: "col-span-3 justify-center text-center" },
    { value: "수      도", className: "col-span-2 justify-center text-center" },
    ...["년  월", "금량", "전량", "증감", "금량"].map((value) => ({ value, className: "justify-center text-center" })),
    ...trendMonths.flatMap((label) => [
      { value: label, className: "justify-center text-center" },
      ...Array.from({ length: 5 }, () => ({ value: "", className: "justify-end text-right" })),
    ]),
  ];

  return (
    <div
      className={`relative h-[1123px] w-[794px] overflow-hidden rounded-[4px] border border-[#e8ebee] bg-white ${PAPER_TEXT} ${highlighted ? "shadow-[0_0_0_2.5px_#14a497]" : "shadow-none"}`}
      data-testid="giro-paper"
      data-highlighted={highlighted || undefined}
    >
      <p className="absolute left-[111.57px] top-[58.48px] whitespace-nowrap text-[18px] leading-[23.4px]">{building?.address ?? ""}</p>
      <p className="absolute left-[111.71px] top-[78.66px] whitespace-nowrap text-[18px] leading-[23.4px]">{building?.name ? `${building.name} ${unit}` : unit}</p>
      <p className="absolute left-[30.24px] top-[249.9px] whitespace-pre text-[13px] leading-[16.9px]">{accountLine(accounts, companyName)}</p>
      <p className="absolute left-[387.16px] top-[284.8px] whitespace-pre text-[14px] leading-[18.2px]">{`${year}      ${month}`}</p>
      <p className="absolute left-[433.4px] top-[302.4px] whitespace-nowrap text-[15px] font-bold leading-[19.5px]">{amount(total)}</p>
      <p className="absolute left-[66.53px] top-[317.02px] whitespace-nowrap text-[12px] leading-[15.6px]">{building?.name ? `${building.name} ${unit}` : unit}</p>
      <p className="absolute left-[345.11px] top-[317.02px] whitespace-nowrap text-[12px] leading-[15.6px]">{target?.payerNo ?? ""}</p>
      <p className="absolute left-[66.44px] top-[331.6px] whitespace-nowrap text-[12px] leading-[15.6px]">{building?.address ?? ""}</p>
      <p className="absolute left-[66.76px] top-[343.97px] whitespace-pre text-[9px] leading-[11.7px]" />
      <p className="absolute left-[329.32px] top-[345.2px] whitespace-nowrap text-[13px] font-bold leading-[16.9px]">{shortDueDate(dueDate)}</p>

      <div className="absolute left-[5.48px] top-[365.43px] grid h-[144px] w-[366px] grid-cols-[58px_44px_44px_33px_33px_58px_47px_48px] grid-rows-[repeat(11,13px)] border-l border-t border-black text-[8.5px] leading-[normal]">
        {feeCells.map((cell, index) => (
          <div key={`fee-cell-${index}`} className={`${CELL} ${cell.className ?? ""}`}>
            {cell.strong ? <strong>{cell.value}</strong> : cell.value}
          </div>
        ))}
      </div>

      <div className="absolute left-[373.83px] top-[363.19px] flex w-[91px] justify-center border border-black py-[1px] text-[9.5px] leading-[normal] font-bold">
        미납내역
      </div>
      <p className="absolute left-[373.72px] top-[385.44px] whitespace-pre text-[9px] leading-[11.7px]">년  월  당월분 연체료</p>
      <p className="absolute left-[408.31px] top-[412.5px] whitespace-pre text-[10px] leading-[13px]">합계          </p>
      <p className="absolute left-[373.8px] top-[466.16px] whitespace-nowrap text-[9px] leading-[11.7px]">수도사용기간</p>
      <p className="absolute left-[373.55px] top-[479.61px] whitespace-nowrap text-[9px] leading-[11.7px]" />

      <div className="absolute left-[509.44px] top-[257.81px] w-[276.99px] text-[7.5px] leading-[10.12px]">
        {noticeLines.map((line, index) => <p key={`notice-${index}`}>{line}</p>)}
      </div>

      <div className="absolute left-[509.44px] top-[482px] grid h-[78px] w-[276px] grid-cols-[61px_41px_41px_41px_41px_50px] grid-rows-[repeat(7,11px)] border-l border-t border-black text-[7.5px] leading-[normal]">
        {trendCells.map((cell, index) => <div key={`trend-cell-${index}`} className={`${CELL} ${cell.className ?? ""}`}>{cell.value}</div>)}
      </div>
      <p className="absolute left-[206.75px] top-[515.48px] whitespace-nowrap text-[9px] leading-[11.7px]">페이지 : 1 / 1</p>

      <div className="absolute left-0 top-[563.84px] h-px w-[792.47px] bg-black" />
      <p className="absolute left-[721.8px] top-[616.42px] whitespace-nowrap text-[16px] font-bold leading-[20.8px]">{amount(total)}</p>
      <p className="absolute left-[100.35px] top-[633.23px] whitespace-nowrap text-[16px] font-bold leading-[20.8px]">{amount(total)}</p>
      <p className="absolute left-[5.55px] top-[670.11px] whitespace-nowrap text-[12px] leading-[15.6px]">{building?.name ? `${building.name} ${unit}` : unit}</p>
      <p className="absolute left-[244.05px] top-[661.14px] whitespace-pre text-[12px] leading-[15.6px]" />
      <p className="absolute left-[39.42px] top-[699.27px] whitespace-nowrap text-[12px] leading-[15.6px]" />
      <p className="absolute left-[631.57px] top-[710.77px] whitespace-nowrap text-[14px] font-bold leading-[18.2px]">{target?.payerNo ?? ""}</p>
      <p className="absolute left-[52.83px] top-[735.14px] whitespace-nowrap text-[12px] leading-[15.6px]">{longDueDate(dueDate)}</p>
      <p className="absolute left-[329.5px] top-[732.89px] whitespace-nowrap text-[12px] leading-[15.6px]">{building?.name ? `${building.name} ${unit}` : unit}</p>
      <p className="absolute left-[345.23px] top-[748.58px] whitespace-nowrap text-[12px] leading-[15.6px]">{building?.address ?? ""}</p>
      <p className="absolute left-[345.11px] top-[764.28px] whitespace-nowrap text-[12px] leading-[15.6px]">{target?.payerNo ?? ""}</p>
      <p className="absolute left-[647.3px] top-[735.14px] whitespace-pre text-[12px] leading-[15.6px]">{`${year}      ${month}`}</p>

      {(showReissue || showWaterCutoff || showAutoDebit) && <GiroStampOverlays reissue={showReissue} waterCutoff={showWaterCutoff} autoDebit={showAutoDebit} />}
    </div>
  );
}
