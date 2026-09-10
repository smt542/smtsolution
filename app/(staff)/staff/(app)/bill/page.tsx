import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { BillWorkspace } from "./components/BillWorkspace";
import { getBillPageData } from "./data";

export default async function BillPage() {
  const me = await getStaffContext();

  if (!me || !hasModule(me, "bill_publish")) {
    return <div className="p-8 text-t2">접근할 권한이 없습니다.</div>;
  }

  const pageData = await getBillPageData(me.orgId);

  return <BillWorkspace {...pageData} />;
}
