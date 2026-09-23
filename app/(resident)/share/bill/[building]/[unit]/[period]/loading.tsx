import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";

export default function PublicBillLoading() {
  return (
    <ResidentAsyncState
      variant="public"
      role="status"
      message="관리비 고지서를 불러오고 있어요"
    />
  );
}
