import type { ModuleKey } from "@/lib/auth/permissions";

export interface NavItem {
  label: string;
  href: string;
  /** 권한 게이트 모듈. undefined = 항상 표시(예: 대시보드). */
  module?: ModuleKey;
  /** 권한 게이트 모듈(any-of). 지정 시 이 중 하나라도 보유하면 표시(예: 수납·민원 통합 화면). */
  modules?: ModuleKey[];
  /** 우리 구현 완료 여부. false면 "준비중" 비활성 표시. */
  built: boolean;
  /** SVG path data (stroke, 24×24). */
  icon: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * 사이드바 네비게이션 (PRD 정본 GNB 기준 — docs/superpowers/specs/2026-08-10-prd-synthesis.md §A).
 * 라우트는 우리 앱의 /staff/* prefix. 미구현 화면은 built:false(준비중).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [
      { label: "대시보드", href: "/staff", built: true, icon: "M4 11l8-6 8 6M6 10v9h12v-9M10 19v-5h4v5" },
    ],
  },
  {
    label: "관리업무",
    items: [
      { label: "건물·입주자", href: "/staff/buildings", module: "buildings", built: true, icon: "M4 3h16a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 20 21H4a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 4 3zm5 5h1m5 0h1M9 12h1m5 0h1M9.5 21v-4h5v4" },
      { label: "고객번호 조회", href: "/staff/customer-numbers", module: "buildings", built: true, icon: "M4 3h13a2 2 0 0 1 2 2v8M8 8h7M8 12h5M8 16h3M17 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM19 21l2 2" },
      { label: "지침·부과", href: "/staff/utilities", module: "utilities", built: false, icon: "M4 18a8 8 0 1 1 16 0M12 14l3.5-3.5" },
      { label: "관리비 부과셋팅", href: "/staff/management-fee", module: "billing", built: true, icon: "M4 8h9M18 8h2M4 16h2M11 16h9M15 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM10 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" },
      { label: "항목등록 관리", href: "/staff/fee-items", module: "billing", built: true, icon: "M4 6h16M4 12h10M4 18h7M17 14l2 2 4-4" },
      { label: "고지서 발행", href: "/staff/bill", module: "bill_publish", built: true, icon: "M5 3h14a2 2 0 0 1 2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h4" },
      { label: "수납·민원 접수", href: "/staff/receipts", modules: ["payment", "complaints"], built: true, icon: "M3 6h18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM3 10h18M7 15h4" },
      { label: "미납관리", href: "/staff/overdue", module: "overdue", built: true, icon: "M12 3a9 9 0 1 1 0 18A9 9 0 0 1 12 3zM12 8v5M12 16h.01" },
      { label: "이사정산", href: "/staff/moving-settlement", module: "moving", built: true, icon: "M3 8l9-4 9 4-9 4-9-4zM3 8v8l9 4 9-4V8" },
      { label: "장기수선비 관리", href: "/staff/long-term-repair", module: "settings", built: true, icon: "M4 19h16M6 16V8m4 8V5m4 11v-6m4 6V3M5 8h2m2-3h2m2 5h2m2-7h2" },
      { label: "문자·알림톡 발송", href: "/staff/messaging", module: "messaging", built: true, icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
      { label: "공지 관리", href: "/staff/notices", module: "notices", built: true, icon: "M3 11l18-5v12L3 14v-3zM7 15v3a2 2 0 0 0 4 0v-2" },
    ],
  },
  {
    label: "설정",
    items: [
      { label: "계정·직원 관리", href: "/staff/accounts", module: "accounts", built: true, icon: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 20a8 8 0 0 1 16 0" },
      { label: "셋업·기타 설정", href: "/staff/setup", module: "settings", built: true, icon: "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" },
    ],
  },
];
