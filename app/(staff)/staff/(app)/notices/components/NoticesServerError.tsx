"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/common";

export function NoticesServerError() {
  const router = useRouter();

  return (
    <div className="p-6">
      <div role="alert" className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="font-bold text-t1">데이터를 불러오지 못했습니다.</p>
        <p className="mt-1 text-sm text-t3">잠시 후 다시 시도해 주세요.</p>
        <Button type="button" variant="ghost" className="mt-4" onClick={() => router.refresh()}>
          다시 시도
        </Button>
      </div>
    </div>
  );
}
