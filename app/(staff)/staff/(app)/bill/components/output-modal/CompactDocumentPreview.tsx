"use client";

import type { BillDocument, BillTarget } from "@/hooks/reactquery/bill";
import type { PrintableAccount } from "@/lib/bill/document";
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
  zoom: number;
  onZoom: (value: number) => void;
}

const PAGE_GAP = 16;

export function CompactDocumentPreview({ companyName, period, pages, accounts, customerNotice, stamps, zoom, onZoom }: CompactDocumentPreviewProps) {
  const scale = (0.796 * zoom) / 100;

  // transform: scale()은 레이아웃 크기를 바꾸지 않으므로, 스크롤 영역이 실제 표시 크기를
  // 갖도록 축소 후 크기를 명시한 래퍼로 감싼다. 이게 없으면 용지 아래가 잘린 채 스크롤이 안 된다.
  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#e8ebee]">
      <div className="min-h-0 flex-1 overflow-auto p-[16px]">
        <div className="flex flex-col" style={{ gap: PAGE_GAP }}>
          {pages.map((page) => (
            <div
              key={`${page.building.id}-${page.document.unitId}`}
              className="shrink-0"
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
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <ZoomControls zoom={zoom} onZoom={onZoom} />
    </section>
  );
}
