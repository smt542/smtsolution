import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";

export default function PublicSettlementLoading() {
  return (
    <ResidentAsyncState
      variant="public"
      role="status"
      message="이사정산 내역을 불러오고 있어요."
    />
  );
}
