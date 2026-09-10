import { Suspense } from "react";
import { EmptyState, Spinner } from "@/components/common";
import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { ReceiptWorkspace } from "./ReceiptWorkspace";

type ReceiptSearchParams = {
  period?: string | string[];
  buildingId?: string | string[];
  unitId?: string | string[];
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePeriod(value: string | string[] | undefined): string | null {
  const period = first(value);
  return period && /^\d{4}-\d{2}-01$/.test(period) ? period : null;
}

function parseId(value: string | string[] | undefined): number | null {
  const raw = first(value);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function ReceiptManagementContent({
  searchParams,
}: {
  searchParams: Promise<ReceiptSearchParams>;
}) {
  const [me, query] = await Promise.all([getStaffContext(), searchParams]);

  if (!me || (!hasModule(me, "payment") && !hasModule(me, "complaints"))) {
    return (
      <div className="p-6">
        <EmptyState message="수납관리·민원접수 권한이 없습니다" />
      </div>
    );
  }

  return (
    <ReceiptWorkspace
      orgId={me.orgId}
      canSendMessages={hasModule(me, "messaging")}
      canEditPayment={hasModule(me, "payment")}
      initialPeriod={parsePeriod(query.period)}
      initialBuildingId={parseId(query.buildingId)}
      initialUnitId={parseId(query.unitId)}
    />
  );
}

export default function ReceiptManagementPage({
  searchParams,
}: {
  searchParams: Promise<ReceiptSearchParams>;
}) {
  return (
    <Suspense fallback={<Spinner />}>
      <ReceiptManagementContent searchParams={searchParams} />
    </Suspense>
  );
}
