import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";

import PublicNoticeFrame from "./PublicNoticeFrame";

export default function PublicNoticeLoading() {
  return (
    <PublicNoticeFrame>
      <ResidentAsyncState
        variant="public"
        role="status"
        message="공지사항을 불러오고 있어요."
      />
    </PublicNoticeFrame>
  );
}
