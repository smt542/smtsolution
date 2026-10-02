import Link from "next/link";
import type { ReactNode } from "react";

import { residentButtonClass } from "./ResidentButton";

type ResidentGuestCtaProps = {
  title: ReactNode;
  description: ReactNode;
  /** 위 여백 — 정본 공지 상세 `.cta` 24px, 관리비 상세 `.cta` 18px. */
  className: string;
};

/** 비로그인 공개 링크 하단 앱 안내 카드(정본 `.cta`). '관리비서 시작하기'는 세입자 로그인으로 보낸다. */
export default function ResidentGuestCta({ title, description, className }: ResidentGuestCtaProps) {
  return (
    <div className={`rounded-[18px] bg-blue-t2 p-[18px] ${className}`}>
      <b className="block text-[15px] font-extrabold tracking-[-0.02em] text-blue-d">{title}</b>
      <span className="mt-1.5 block text-[13px] font-semibold leading-[1.6] text-t3">{description}</span>
      <Link
        href="/resident/login"
        className={residentButtonClass({ size: "md", className: "mt-3.5 flex items-center justify-center no-underline" })}
      >
        관리비서 시작하기
      </Link>
    </div>
  );
}
