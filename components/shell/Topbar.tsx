"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useMe } from "@/hooks/reactquery/auth";
import { MenuIcon, PrinterIcon } from "@/components/icons";
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

const INQUIRY_TITLES: Record<string, string> = {
  water: "수도 이사조회",
  electric: "전기 이사조회",
  gas: "가스 이사조회",
  all: "전체 이사조회",
};

export function Topbar({ onMenu }: TopbarProps) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const title = findPageTitle(pathname);
  const usesRouteActions = pathname.startsWith("/staff/receipts");
  const isBillPage = pathname.startsWith("/staff/bill");
  const isUtilities = pathname.startsWith("/staff/utilities");
  const inquiryType = pathname.match(/\/staff\/moving-settlement\/inquiries\/([^/]+)/)?.[1];
  const inquiryTitle = inquiryType ? INQUIRY_TITLES[inquiryType] : undefined;
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
    <header className="h-[62px] flex-none flex items-center gap-[14px] px-6 bg-white border-b border-line">
      {/* Figma 공통 상단 메뉴 아이콘. 모바일에서는 서랍을 열고 데스크톱에서는 위치 기준을 유지한다. */}
      <button
        type="button"
        onClick={onMenu}
        className="flex h-[36px] w-[36px] shrink-0 items-center justify-center text-t3 transition-colors hover:text-t1"
        aria-label="메뉴 열기"
      >
        <MenuIcon className="size-[20px]" />
      </button>

      {inquiryTitle ? (
        <div className="min-w-0 flex-1 leading-none">
          <p className="text-[12px] font-semibold leading-[15px] text-t3">이사정산</p>
          <h1 className="mt-[3px] text-[19px] font-extrabold leading-[23px] tracking-[-0.38px] text-t1">
            {inquiryTitle}
          </h1>
        </div>
      ) : isElectricityUtilities ? (
        <div className="min-w-0 flex-1 leading-none">
          <p className="text-[10px] font-semibold leading-[12px] text-t3">공과금 관리</p>
          <h1 className="mt-[3px] text-[17px] font-extrabold leading-[21px] tracking-[-0.35px] text-t1">
            전기
          </h1>
        </div>
      ) : (
        <h1 className="flex-1 text-[19px] font-extrabold tracking-tight text-t1">
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

      {/* avatar */}
      {me && !usesRouteActions && !isElectricityUtilities && !isBillPage && !inquiryTitle && (
        <div className="w-[40px] h-[40px] rounded-[11px] flex items-center justify-center bg-[#DCE3EA] text-[14px] font-bold text-t2 select-none flex-none">
          {me.fullName.charAt(0)}
        </div>
      )}
    </header>
  );
}
