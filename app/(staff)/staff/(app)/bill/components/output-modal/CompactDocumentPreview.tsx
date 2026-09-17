"use client";

import type { BillDocument, BillTarget } from "@/hooks/reactquery/bill";
import type { PrintableAccount } from "@/lib/bill/document";
import type { BillBuilding } from "../../types";
import type { GiroStampOptions } from "../GiroPrintView";
import { GiroPaper, GIRO_PAPER_HEIGHT, GIRO_PAPER_WIDTH } from "./GiroPaper";
import { ZoomControls } from "./OutputModalPrimitives";

interface CompactDocumentPreviewProps {
  type: "giro" | "fax";
  companyName: string;
  period: string;
  building?: BillBuilding;
  target?: BillTarget;
  document?: BillDocument;
  accounts: PrintableAccount[];
  customerNotice: string | null;
  dueDate: string | null;
  stamps?: GiroStampOptions;
  zoom: number;
  onZoom: (value: number) => void;
}

export function CompactDocumentPreview(props: CompactDocumentPreviewProps) {
  const { zoom, onZoom } = props;
  const scale = (0.796 * zoom) / 100;

  // transform: scale()은 레이아웃 크기를 바꾸지 않으므로, 스크롤 영역이 실제 표시 크기를
  // 갖도록 축소 후 크기를 명시한 래퍼로 감싼다. 이게 없으면 용지 아래가 잘린 채 스크롤이 안 된다.
  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#e8ebee]">
      <div className="min-h-0 flex-1 overflow-auto p-[16px]">
        <div style={{ width: GIRO_PAPER_WIDTH * scale, height: GIRO_PAPER_HEIGHT * scale }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <GiroPaper {...props} />
          </div>
        </div>
      </div>
      <ZoomControls zoom={zoom} onZoom={onZoom} />
    </section>
  );
}
