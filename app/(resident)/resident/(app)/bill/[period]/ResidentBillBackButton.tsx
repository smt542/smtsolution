"use client";

import {
  residentBackButtonClass,
  residentBackIconClass,
} from "@/app/(resident)/_components/MobileBackHeader";
import { useRouter } from "next/navigation";

export default function ResidentBillBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className={residentBackButtonClass}
      aria-label="뒤로가기"
      onClick={() => router.back()}
    >
      <svg
        className={residentBackIconClass.bar}
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
