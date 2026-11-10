"use client";

import { useEffect } from "react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

/**
 * 라우트 세그먼트 `error.tsx` 공통 폴백.
 *
 * 화면 일부의 렌더링 오류가 앱 전체를 빈 화면으로 만들지 않도록, 각 사용자 영역 `(app)` 세그먼트의
 * `error.tsx` 가 이 컴포넌트를 렌더한다. 레이아웃(사이드바·상단바)은 경계 밖이라 그대로 남는다.
 * 운영 환경의 서버 오류 메시지는 Next 가 숨기므로 사용자에게는 고정 문구와 오류 식별자(digest)만 보인다.
 */
export function RouteErrorFallback({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[320px] flex-1 flex-col">
      <EmptyState
        title="화면을 불러오지 못했어요"
        description={
          <>
            일시적인 문제일 수 있어요. 다시 시도해 주세요.
            {error.digest ? <span className="mt-[4px] block text-[12px] text-t4">오류 코드 {error.digest}</span> : null}
          </>
        }
      />
      <div className="flex justify-center pb-[40px]">
        <Button variant="ghost" onClick={() => retry()}>
          다시 시도
        </Button>
      </div>
    </div>
  );
}
