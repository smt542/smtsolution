import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";

export default function PublicNoticeLoading() {
  return (
    <ResidentAsyncState
      variant="public"
      role="status"
      message="공지사항을 불러오고 있어요."
    />
  );
}
