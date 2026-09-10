"use client";

import { useRouter } from "next/navigation";

export default function ResidentBillBackButton() {
  const router = useRouter();

  return (
    <button type="button" aria-label="뒤로가기" onClick={() => router.back()}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}
