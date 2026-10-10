import type { ReactNode } from "react";

/**
 * 공지 목록 + 공지 보기 시트(@modal).
 * 목록에서 공지를 누르면 /resident/notice/[id] 를 가로채(@modal/(.)[id]) 목록 위 바텀시트로 연다.
 * 링크로 바로 들어오거나 새로고침하면 공지 상세 화면([id]/page)이 그대로 열린다.
 */
export default function ResidentNoticeLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
