"use client";

import type { BillDocument, BillTarget } from "@/hooks/reactquery/bill";
import { displayUnitNo, type PrintableAccount } from "@/lib/bill/document";
import type { BillBuilding } from "../../types";
import type { GiroStampOptions } from "../GiroPrintView";
import { GiroPaper, GIRO_PAPER_HEIGHT, GIRO_PAPER_WIDTH } from "./GiroPaper";
import { ZoomControls } from "./OutputModalPrimitives";

export interface GiroPreviewPage {
  building: BillBuilding;
  target: BillTarget;
  document: BillDocument;
  dueDate: string | null;
}

interface CompactDocumentPreviewProps {
  companyName: string;
  period: string;
  pages: GiroPreviewPage[];
  accounts: PrintableAccount[];
  customerNotice: string | null;
  stamps?: GiroStampOptions;
  /** 도장이 찍히는 호수 = 청록 테두리가 붙는 호수. 개별 범위에서는 클릭한 1건뿐이다. */
  highlightedUnitIds: number[];
  onSelectUnit: (unitId: number) => void;
  zoom: number;
  onZoom: (value: number) => void;
}

const PAGE_GAP = 16;

export function CompactDocumentPreview({ companyName, period, pages, accounts, customerNotice, stamps, highlightedUnitIds, onSelectUnit, zoom, onZoom }: CompactDocumentPreviewProps) {
  const scale = (0.796 * zoom) / 100;

  // transform: scale()은 레이아웃 크기를 바꾸지 않으므로, 스크롤 영역이 실제 표시 크기를
  // 갖도록 축소 후 크기를 명시한 래퍼로 감싼다. 이게 없으면 용지 아래가 잘린 채 스크롤이 안 된다.
  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#e8ebee]">
      <div className="min-h-0 flex-1 overflow-auto p-[16px]">
        <div className="flex flex-col" style={{ gap: PAGE_GAP }}>
          {pages.map((page) => {
            const unitId = page.document.unitId;
            const highlighted = highlightedUnitIds.includes(unitId);
            return (
              <div
                key={`${page.building.id}-${unitId}`}
                role="button"
                tabIndex={0}
                aria-pressed={highlighted}
                aria-label={`${displayUnitNo(page.target.unitNo ?? page.document.unitNo)} 고지서 선택`}
                onClick={() => onSelectUnit(unitId)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onSelectUnit(unitId);
                }}
                className="shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#b7ebe4]"
                style={{ width: GIRO_PAPER_WIDTH * scale, height: GIRO_PAPER_HEIGHT * scale }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <GiroPaper
                    companyName={companyName}
                    period={period}
                    building={page.building}
                    target={page.target}
                    document={page.document}
                    accounts={accounts}
                    customerNotice={customerNotice}
                    dueDate={page.dueDate}
                    stamps={stamps}
                    highlighted={highlighted}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ZoomControls zoom={zoom} onZoom={onZoom} />
    </section>
  );
}
