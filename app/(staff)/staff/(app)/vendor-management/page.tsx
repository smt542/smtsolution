import { EmptyState } from "@/components/common";
import { VendorManagementSection } from "@/components/vendors/VendorManagementSection";
import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";

export default async function VendorManagementPage() {
  const me = await getStaffContext();

  if (!me || !hasModule(me, "vendors")) {
    return (
      <div className="p-6">
        <EmptyState message="권한이 없습니다" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <VendorManagementSection />
    </div>
  );
}
