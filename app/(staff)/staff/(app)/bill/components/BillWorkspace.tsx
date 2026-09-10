"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { BillPageData } from "../types";
import { DocumentCards, type OutputDocumentType } from "./DocumentCards";
import type { DocumentOutputModalProps } from "./DocumentOutputModal";

const DocumentOutputModal = dynamic<DocumentOutputModalProps>(() =>
  import("./DocumentOutputModal").then((module) => module.DocumentOutputModal),
);

export function BillWorkspace({ buildings, companyName, accounts, customerNotice }: BillPageData) {
  const [activeDocument, setActiveDocument] = useState<OutputDocumentType | null>(null);

  return (
    <>
      <div className="min-h-[calc(100vh-62px)] bg-[#f2f4f6] px-[24px] pt-[22px] print:hidden">
        <h1 className="sr-only">서류 발행·출력</h1>
        <DocumentCards onOpen={setActiveDocument} />
      </div>

      {activeDocument && (
        <DocumentOutputModal
          key={activeDocument}
          type={activeDocument}
          buildings={buildings}
          companyName={companyName}
          accounts={accounts}
          customerNotice={customerNotice}
          onClose={() => setActiveDocument(null)}
        />
      )}
    </>
  );
}
