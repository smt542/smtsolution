"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";
import { Spinner } from "@/components/common";
import { fetchBillPageData } from "../pageDataClient";
import type { OutputDocumentType } from "../types";
import type { DocumentOutputModalProps } from "./DocumentOutputModal";

const DocumentOutputModal = dynamic<DocumentOutputModalProps>(() =>
  import("./DocumentOutputModal").then((module) => module.DocumentOutputModal),
);

const outputDocumentTypes = new Set<OutputDocumentType>([
  "giro",
  "adjustment",
  "autoDebit",
  "fax",
]);

interface BillWorkspaceProps {
  children: ReactNode;
}

interface DataStateModalProps {
  isError: boolean;
  onClose: () => void;
  onRetry: () => void;
}

function DataStateModal({ isError, onClose, onRetry }: DataStateModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,31,40,0.45)] p-3 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="서류 발행 정보"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex min-h-[180px] w-[420px] max-w-[calc(100vw-24px)] flex-col items-center justify-center gap-5 rounded-[20px] bg-white p-8 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.4)]">
        {isError ? (
          <>
            <p role="alert" className="text-[14px] font-bold text-[#f04452]">
              서류 발행 정보를 불러오지 못했습니다.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-[11px] border border-[#e8ebee] px-4 text-[13.5px] font-bold text-[#4e5968]">
                닫기
              </button>
              <button type="button" onClick={onRetry} className="inline-flex h-10 items-center justify-center rounded-[11px] bg-[#14a497] px-4 text-[13.5px] font-bold text-white">
                다시 시도
              </button>
            </div>
          </>
        ) : (
          <Spinner label="서류 발행 정보 불러오는 중" />
        )}
      </div>
    </div>
  );
}

export function BillWorkspace({ children }: BillWorkspaceProps) {
  const [activeDocument, setActiveDocument] = useState<OutputDocumentType | null>(null);
  const pageData = useQuery({
    queryKey: ["bill", "page-data", activeDocument] as const,
    queryFn: () => fetchBillPageData(activeDocument ?? undefined),
    enabled: activeDocument !== null,
  });

  const handleMenuClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const button = target.closest<HTMLButtonElement>("button[data-output-document]");
    if (!button || !event.currentTarget.contains(button)) return;

    const type = button.dataset.outputDocument as OutputDocumentType | undefined;
    if (type && outputDocumentTypes.has(type)) setActiveDocument(type);
  };

  return (
    <>
      <div onClick={handleMenuClick}>{children}</div>

      {activeDocument && pageData.data ? (
        <DocumentOutputModal
          key={activeDocument}
          type={activeDocument}
          {...pageData.data}
          onClose={() => setActiveDocument(null)}
        />
      ) : null}

      {activeDocument && !pageData.data ? (
        <DataStateModal
          isError={pageData.isError && !pageData.isFetching}
          onClose={() => setActiveDocument(null)}
          onRetry={() => void pageData.refetch()}
        />
      ) : null}
    </>
  );
}
