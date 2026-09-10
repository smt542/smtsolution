import { EmptyState } from "@/components/common";
import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { CustomerNumberLookupContent } from "./components/CustomerNumberLookupContent";

export default async function CustomerNumberLookupPage() {
  const me = await getStaffContext();

  if (!me || !hasModule(me, "utilities")) {
    return (
      <div className="p-6">
        <EmptyState message="고객번호 조회 권한이 없습니다" />
      </div>
    );
  }

  return <CustomerNumberLookupContent />;
}
