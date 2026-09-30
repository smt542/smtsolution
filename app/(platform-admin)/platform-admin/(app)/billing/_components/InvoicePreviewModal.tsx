"use client";

import { useState } from "react";
import { Button } from "@/components/common";
import { appToast as toast } from "@/hooks/common/useAppToast";
import type { PlatformOrgBilling, PlatformSettings } from "@/hooks/reactquery/platform";
import { type InvoiceConfig, InvoiceDocument } from "./InvoiceDocument";

/**
 * Single-organization invoice preview. "청구서 다운로드" saves the same invoice as an A4 PDF
 * ({YYYY}_{MM}월분_{테넌트명}_청구서.pdf). No "published" state is persisted anywhere.
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
  const [downloading, setDownloading] = useState(false);

  // 정본 #ivPdf: '청구서를 만들고 있어요' → 저장(실패 시 '저장에 실패했어요'). 만드는 동안 다시 눌러도 무시
  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    toast.info("청구서를 만들고 있어요");
    try {
      const { downloadInvoicePdf } = await import("./InvoicePdf");
      await downloadInvoicePdf({ row, month, config, settings });
    } catch (error) {
      toast.error(error, "저장에 실패했어요");
    } finally {
      setDownloading(false);
    }
  };

  return (
    // 정본 .iv-scrim(패딩 28) + .iv-modal(min(620px,94vw)·최대 90vh·r18) — 머리글 없이 청구서가 바로 본문
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-7"
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
          <Button type="button" className="border border-transparent shadow-hf-btn" onClick={() => void handleDownload()}>
            청구서 다운로드
          </Button>
        </div>
      </div>
    </div>
  );
}
