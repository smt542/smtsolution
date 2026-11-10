"use client";

import { Button } from "@/components/common/Button";
import "./globals.css";

/**
 * 루트 레이아웃 자체가 실패했을 때의 최후 폴백. 루트 레이아웃을 대체하므로 html/body 를 직접 둔다.
 * QueryProvider 밖이므로 프로바이더가 필요 없는 공용 Button 만 쓴다.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <title>관리비서</title>
        <main className="flex min-h-screen flex-col items-center justify-center gap-[12px] px-[24px] text-center">
          <p className="text-[16px] font-bold text-t1">서비스를 불러오지 못했어요</p>
          <p className="text-[13.5px] text-t3">잠시 후 다시 시도해 주세요.</p>
          {error.digest ? <p className="text-[12px] text-t4">오류 코드 {error.digest}</p> : null}
          <Button variant="ghost" className="mt-[8px]" onClick={() => retry()}>
            다시 시도
          </Button>
        </main>
      </body>
    </html>
  );
}
