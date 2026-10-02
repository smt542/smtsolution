import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";

import PublicBillFrame from "./PublicBillFrame";

export default function PublicBillLoading() {
  return (
    <PublicBillFrame>
      <ResidentAsyncState
        variant="public"
        role="status"
        message="관리비 고지서를 불러오고 있어요"
      />
    </PublicBillFrame>
  );
}
