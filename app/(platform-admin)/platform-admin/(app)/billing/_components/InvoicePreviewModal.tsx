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
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-3 print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-preview-title"
        onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      >
        <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-hf-modal">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <p className="text-xs font-bold text-blue">청구서 미리보기</p>
              <h2 id="invoice-preview-title" className="mt-0.5 text-xl font-extrabold text-t1">
                {row.orgName} 발송비 청구서
              </h2>
            </div>
            <button
              type="button"
              aria-label="청구서 미리보기 닫기"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-t3 hover:bg-bg"
            >
              ×
            </button>
          </header>

          <main className="min-h-0 flex-1 overflow-auto bg-slate-200/70 p-5">
            <div className="shadow-card">
              <InvoiceDocument row={row} month={month} config={config} settings={settings} />
            </div>
          </main>

          <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              닫기
            </Button>
            <Button type="button" onClick={() => window.print()}>
              청구서 다운로드
            </Button>
          </footer>
        </div>
      </div>

      {/* Print-only root: only this organization's invoice is printed. */}
      <div className="hidden print:block" data-testid="invoice-print-root">
        <InvoiceDocument row={row} month={month} config={config} settings={settings} />
      </div>
    </>
  );
}
