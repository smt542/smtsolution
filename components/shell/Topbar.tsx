"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PrinterIcon } from "@/components/icons";
import { NAV_GROUPS } from "./navItems";

interface TopbarProps {
  onMenu: () => void;
}

function findPageTitle(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const match =
        item.href === "/staff" ? pathname === "/staff" : pathname.startsWith(item.href);
      if (match) return item.label;
    }
  }
  return "관리비서";
}

export function Topbar({ onMenu }: TopbarProps) {
  const pathname = usePathname();
  const title = findPageTitle(pathname);
  const isUtilities = pathname.startsWith("/staff/utilities");
  const isMovingInquiry = pathname.startsWith("/staff/moving-settlement/inquiries/");
  const isMovingSettlement = pathname === "/staff/moving-settlement";
  const isCustomerNumbers = pathname === "/staff/customer-numbers";
  const [utilityType, setUtilityType] = useState<"electricity" | "water" | "gas">("gas");
  const isElectricityUtilities =
    isUtilities && utilityType === "electricity";

  useEffect(() => {
    if (!isUtilities) return;
    const updateTitle = (event: Event) => {
      const nextType = (event as CustomEvent<"electricity" | "water" | "gas">).detail;
      if (nextType === "electricity" || nextType === "water" || nextType === "gas") {
        setUtilityType(nextType);
      }
    };
    const initialSync = window.setTimeout(() => {
      const type = new URLSearchParams(window.location.search).get("type");
      setUtilityType(type === "electricity" ? "electricity" : type === "water" ? "water" : "gas");
    }, 0);
    window.addEventListener("utilities:type-change", updateTitle);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("utilities:type-change", updateTitle);
    };
  }, [isUtilities]);

  const dispatchUtilityAction = (action: "print" | "carry-over") => {
    window.dispatchEvent(new CustomEvent(`utilities:${action}`));
  };

  return (
    <header className="h-[62px] flex-none flex items-center gap-[12px] px-6 bg-white border-b border-line">
      {/* 캔버스 hf-top lnb-btn: 36×36 rounded, hover 배경 채움 */}
      <button
        type="button"
        onClick={onMenu}
        className="mr-[2px] flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] text-t2 transition-colors hover:bg-bg"
        aria-label="메뉴 열기"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[20px] w-[20px]" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {isElectricityUtilities || isMovingInquiry || isMovingSettlement || isCustomerNumbers ? (
        <div className="min-w-0 flex-1 leading-none">
          <p className={`${isMovingInquiry || isCustomerNumbers ? "text-[12px] leading-[15px]" : "text-[10px] leading-[12px]"} font-semibold text-t3`}>
            {isMovingInquiry || isMovingSettlement ? "이사정산" : "공과금 관리"}
          </p>
          <h1 className={`${isMovingInquiry || isCustomerNumbers ? "text-[19px] leading-[23px]" : "text-[17px] leading-[21px]"} ${isCustomerNumbers ? "" : "mt-[3px]"} font-extrabold tracking-[-0.35px] text-t1`}>
            {isMovingInquiry
              ? pathname.endsWith("/all")
                ? "전체 이사조회"
                : pathname.endsWith("/electric")
                  ? "전기 이사조회"
                  : pathname.endsWith("/water")
                    ? "수도 이사조회"
                    : "가스 이사조회"
              : isMovingSettlement
                ? "이사정산 입력"
                : isCustomerNumbers
                  ? "고객번호 조회"
                  : "전기"}
          </h1>
        </div>
      ) : (
        <h1 className="flex-1 text-[19px] font-extrabold tracking-[-0.02em] text-t1">
          {title}
        </h1>
      )}

      {isElectricityUtilities && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dispatchUtilityAction("print")}
            className="flex h-10 items-center gap-1.5 rounded-[10px] border border-line bg-white px-[14px] text-[13px] font-bold text-t2 transition-colors hover:bg-bg"
          >
            <PrinterIcon className="size-4" />
            검침대장 출력
          </button>
          <button
            type="button"
            onClick={() => dispatchUtilityAction("carry-over")}
            className="h-10 rounded-[10px] bg-teal px-[17px] text-[13px] font-bold text-white transition-colors hover:bg-teal-d"
          >
            전체 이월
          </button>
        </div>
      )}
    </header>
  );
}
