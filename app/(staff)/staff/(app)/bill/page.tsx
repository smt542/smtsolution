import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { BillWorkspace } from "./components/BillWorkspace";
import { DocumentCards } from "./components/DocumentCards";

export default async function BillPage() {
  const me = await getStaffContext();

  if (!me || !hasModule(me, "bill_publish")) {
    return <div className="p-8 text-t2">접근할 권한이 없습니다.</div>;
  }

  return (
    <BillWorkspace>
      <div className="min-h-[calc(100vh-62px)] bg-[#f2f4f6] px-[24px] pt-[22px] print:hidden">
        <h1 className="sr-only">서류 발행·출력</h1>
        <DocumentCards />
      </div>
    </BillWorkspace>
  );
}
