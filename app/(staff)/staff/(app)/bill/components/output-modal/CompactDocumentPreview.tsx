"use client";

import type { BillDocument, BillTarget } from "@/hooks/reactquery/bill";
import type { PrintableAccount } from "@/lib/bill/document";
import type { BillBuilding } from "../../types";
import type { GiroStampOptions } from "../GiroPrintView";
import { GiroPaper } from "./GiroPaper";
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
  return (
    <section className="relative flex min-h-0 flex-1 items-start justify-start overflow-hidden bg-[#e8ebee] p-[16px]">
      <div style={{ transform: `scale(${0.796 * zoom / 100})`, transformOrigin: "top left" }}>
        <GiroPaper {...props} />
      </div>
      <ZoomControls zoom={zoom} onZoom={onZoom} />
    </section>
  );
}
