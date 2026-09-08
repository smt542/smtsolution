"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBillOrganizationName } from "@/hooks/reactquery/bill";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { hasModule } from "@/lib/auth/permissions";
import { printableAccounts, PROGRAM_COMPANY_NAME } from "@/lib/bill/document";
import { DocumentCards, type OutputDocumentType } from "./components/DocumentCards";
import type { DocumentOutputModalProps } from "./components/DocumentOutputModal";

const DocumentOutputModal = dynamic<DocumentOutputModalProps>(() =>
  import("./components/DocumentOutputModal").then((module) => module.DocumentOutputModal),
);

export default function BillPage() {
  const { data: me } = useMe();
  const { data: allBuildings = [], isLoading: areBuildingsLoading } = useBuildings();
  const { data: config } = useSetupConfig(me?.orgId);
  const { data: organizationName } = useBillOrganizationName(me?.orgId);
  const [activeDocument, setActiveDocument] = useState<OutputDocumentType | null>(null);

  if (me === undefined) return <Spinner />;
  if (!me || !hasModule(me, "bill_publish")) {
    return <div className="p-8 text-t2">접근할 권한이 없습니다.</div>;
  }

  const buildings = allBuildings.filter((building) => building.orgId === me.orgId);

  return (
    <>
      <div className="min-h-[calc(100vh-62px)] bg-[#f2f4f6] px-[24px] pt-[22px] print:hidden">
        <h1 className="sr-only">서류 발행·출력</h1>
        {areBuildingsLoading ? <Spinner /> : <DocumentCards onOpen={setActiveDocument} />}
      </div>

      {activeDocument && (
        <DocumentOutputModal
          key={activeDocument}
          type={activeDocument}
          buildings={buildings}
          companyName={organizationName ?? PROGRAM_COMPANY_NAME}
          accounts={printableAccounts(config)}
          customerNotice={config?.customerNotice ?? null}
          onClose={() => setActiveDocument(null)}
        />
      )}
    </>
  );
}
