import { EmptyState } from "@/components/common";
import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { ReceiptWorkspace } from "./ReceiptWorkspace";

export type ReceiptSearchParams = {
  buildingId?: string | string[];
  unitId?: string | string[];
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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
      initialBuildingId={parseId(query.buildingId)}
      initialUnitId={parseId(query.unitId)}
    />
  );
}
