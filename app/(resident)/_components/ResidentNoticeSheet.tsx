"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import ResidentBottomSheet from "./ResidentBottomSheet";
import { ResidentButton } from "./ResidentButton";

/**
 * 공지 목록에서 연 공지 보기 바텀시트(퇴실 신청 시트와 같은 모양).
 * 주소가 /resident/notice/[id] 로 바뀌어 있으므로 닫기(배경·Esc·닫기 버튼)는 뒤로 가기로 목록에 돌아간다.
 */
export default function ResidentNoticeSheet({ children }: { children: ReactNode }) {
  const router = useRouter();
  const close = () => router.back();

  return (
    <ResidentBottomSheet variant="notice" open onDismiss={close}>
      <div role="dialog" aria-modal="true" aria-label="공지" className="flex flex-col">
        {children}
        <div className="sticky bottom-0 shrink-0 bg-white pb-[15px] pt-[18px]">
          <ResidentButton variant="primary" size="moveOut" type="button" className="w-full" onClick={close}>
            닫기
          </ResidentButton>
        </div>
      </div>
    </ResidentBottomSheet>
  );
}
