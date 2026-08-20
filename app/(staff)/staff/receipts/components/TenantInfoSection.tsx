"use client";

import type { ReactNode } from "react";
import { Panel, Spinner } from "@/components/common";
import type { UnitOccupancyFull } from "@/hooks/reactquery/occupancies";
import { BILL_DELIVERY_LABEL, TRANSFER_METHOD_LABEL, formatDate } from "../receiptFormat";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-bg px-3 py-2">
      <p className="text-xs font-bold text-t3">{label}</p>
      <p className="mt-1 text-sm font-semibold text-t1">{value}</p>
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  return <span className={value ? "text-blue" : "text-t4"}>{value ? "Y" : "N"}</span>;
}

export function TenantInfoSection({
  data,
  isLoading,
  hasUnit,
}: {
  data: UnitOccupancyFull | undefined;
  isLoading: boolean;
  hasUnit: boolean;
}) {
  const occ = data?.occupancy ?? null;

  return (
    <Panel title="입주자정보">
      {!hasUnit ? (
        <p className="py-10 text-center text-sm text-t4">호실을 선택하면 입주자정보가 표시돼요</p>
      ) : isLoading ? (
        <Spinner />
      ) : occ === null ? (
        <p className="py-10 text-center text-sm text-t4">등록된 입주자 정보가 없습니다 (공실)</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Field label="입주자명" value={occ.tenantName ?? "-"} />
            <Field label="입금자명" value={occ.payerName ?? "-"} />
            <Field label="전화번호" value={occ.phone ?? "-"} />
            <Field label="적요" value={occ.billingNote ?? occ.settlementNote ?? "-"} />
            <Field label="입주일" value={formatDate(occ.moveInDate)} />
            <Field label="퇴거일" value={formatDate(occ.moveOutDate)} />
            <Field
              label="이체방식"
              value={TRANSFER_METHOD_LABEL[occ.transferMethod] ?? occ.transferMethod}
            />
            <Field
              label="고지서 전달"
              value={BILL_DELIVERY_LABEL[occ.billDelivery] ?? occ.billDelivery}
            />
            <Field label="부과" value={<YesNo value={occ.billingEnabled} />} />
            <Field label="출력" value={<YesNo value={occ.printEnabled} />} />
          </div>
          <p className="mt-3 text-xs text-t4">
            문자·알림톡 수신동의 및 정보 수정은 다음 단계(P2)에서 연결됩니다.
          </p>
        </>
      )}
    </Panel>
  );
}
