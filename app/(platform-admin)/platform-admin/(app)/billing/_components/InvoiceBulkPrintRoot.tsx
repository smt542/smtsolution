"use client";

import type { PlatformOrgBilling, PlatformSettings } from "@/hooks/reactquery/platform";
import { type InvoiceConfig, InvoiceDocument } from "./InvoiceDocument";

/**
 * Print-only root for "전체 발행": stacks one invoice document per billable
 * organization, each forced onto its own printed page. Hidden on screen; the caller
 * mounts it and immediately calls window.print(). No DB state is written — bulk
 * publish is purely document generation.
 */
export function InvoiceBulkPrintRoot({
  rows,
  month,
  config,
  settings,
}: {
  rows: PlatformOrgBilling[];
  month: string;
  config: InvoiceConfig;
  settings: PlatformSettings | undefined;
}) {
  return (
    <>
      <style>{"@media print { @page { size: A4; margin: 12mm; } }"}</style>
      <div className="hidden print:block" data-testid="invoice-bulk-print-root">
        {rows.map((row, index) => (
          <div
            key={row.orgId}
            style={index < rows.length - 1 ? { breakAfter: "page", pageBreakAfter: "always" } : undefined}
          >
            <InvoiceDocument row={row} month={month} config={config} settings={settings} />
          </div>
        ))}
      </div>
    </>
  );
}
