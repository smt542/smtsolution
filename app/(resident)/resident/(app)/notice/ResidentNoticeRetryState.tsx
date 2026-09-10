"use client";

import { useRouter } from "next/navigation";

type ResidentNoticeRetryStateProps = {
  className: string;
  message: string;
};

export default function ResidentNoticeRetryState({
  className,
  message,
}: ResidentNoticeRetryStateProps) {
  const router = useRouter();

  return (
    <div className={className} role="alert">
      <b>{message}</b>
      <button type="button" onClick={() => router.refresh()}>
        다시 시도
      </button>
    </div>
  );
}
