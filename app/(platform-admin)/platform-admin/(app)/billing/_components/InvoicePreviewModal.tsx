"use client";

import { Button } from "@/components/common";
import type { PlatformOrgBilling, PlatformSettings } from "@/hooks/reactquery/platform";
import { type InvoiceConfig, InvoiceDocument } from "./InvoiceDocument";

/**
 * Single-organization invoice preview. Downloading uses the browser print dialog
 * (the same pattern staff document printing uses: window.print() + a print-only
 * root + a scoped @media print block), so no image/PDF dependency is required and
 * no "published" state is persisted anywhere.
 */
export function InvoicePreviewModal({
  row,
  month,
  config,
  settings,
  onClose,
}: {
  row: PlatformOrgBilling;
  month: string;
  config: InvoiceConfig;
  settings: PlatformSettings | undefined;
  onClose: () => void;
}) {
  return (
    <>
      <style>{"@media print { @page { size: A4; margin: 12mm; } }"}</style>
      {/* 정본 .iv-scrim(패딩 28) + .iv-modal(min(620px,94vw)·최대 90vh·r18) — 머리글 없이 청구서가 바로 본문 */}
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-7 print:hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`${row.orgName} 발송비 청구서`}
        onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      >
        <div className="flex max-h-[90vh] w-[min(620px,94vw)] flex-col overflow-hidden rounded-[18px] bg-surface shadow-[0_24px_60px_-20px_rgba(23,31,40,0.4)]">
          <div className="min-h-0 flex-1 overflow-auto">
            <InvoiceDocument row={row} month={month} config={config} settings={settings} />
          </div>

          {/* 정본 .iv-ft: 닫기(.hf-btn.sec) 왼쪽 · 청구서 다운로드(.hf-btn.pri) 오른쪽 */}
          <div className="flex items-center gap-2 border-t border-line2 px-[22px] pb-[18px] pt-[14px]">
            <Button type="button" variant="ghost" onClick={onClose}>
              닫기
            </Button>
            <div className="flex-1" />
            <Button type="button" className="border border-transparent shadow-hf-btn" onClick={() => window.print()}>
              청구서 다운로드
            </Button>
          </div>
        </div>
      </div>

      {/* Print-only root: only this organization's invoice is printed. */}
      <div className="hidden print:block" data-testid="invoice-print-root">
        <InvoiceDocument row={row} month={month} config={config} settings={settings} />
      </div>
    </>
  );
}
