import type { ModuleKey } from "@/lib/auth/permissions";

export interface NavItem {
  label: string;
  href: string;
  module: ModuleKey;
  built: boolean;
  /** SVG path data (stroke, 24×24 viewBox). Rendered as <path d={icon} />. */
  icon: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar navigation definition.
 * Icon paths are taken from the prototype _design-system.css sidebar markup (lines 348-356).
 * All icons use stroke="currentColor", strokeLinecap="round", strokeLinejoin="round".
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "관리업무",
    items: [
      {
        label: "건물·입주자",
        href: "/staff/building-list",
        module: "buildings",
        built: true,
        // rect + window dots + door: prototype pcToBuildings icon
        icon: "M4 3h16a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 20 21H4a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 4 3zm5 5h1m5 0h1M9 12h1m5 0h1M9.5 21v-4h5v4",
      },
      {
        label: "지침·부과",
        href: "/staff/metering",
        module: "billing",
        built: false,
        // arc + diagonal: prototype pcToUtilities icon
        icon: "M4 18a8 8 0 1 1 16 0M12 14l3.5-3.5",
      },
      {
        label: "관리비 셋팅",
        href: "/staff/fee-item",
        module: "fee_items",
        built: true,
        // sliders: prototype pcToMgmt icon
        icon: "M4 8h9M18 8h2M4 16h2M11 16h9M15 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM10 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
      },
      {
        label: "고지서 발행",
        href: "/staff/billing",
        module: "billing",
        built: false,
        // document lines: prototype pcToBill icon
        icon: "M5 3h14a2 2 0 0 1 2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h4",
      },
      {
        label: "수납·민원",
        href: "/staff/receipt-management",
        module: "arrears",
        built: true,
        // chat bubble: prototype pcToReceipt icon
        icon: "M4 5h16v10H9l-4 4z",
      },
      {
        label: "수납처리",
        href: "/staff/payment",
        module: "arrears",
        built: false,
        // credit card: prototype pcToPayment icon
        icon: "M3 6h18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM3 10h18M7 15h4",
      },
      {
        label: "미납관리",
        href: "/staff/overdue",
        module: "arrears",
        built: false,
        // alert circle: prototype pcToOverdue icon
        icon: "M12 3a9 9 0 1 1 0 18A9 9 0 0 1 12 3zM12 8v5M12 16h.01",
      },
      {
        label: "이사정산",
        href: "/staff/move-settle",
        module: "move_settle",
        built: false,
        // box/package: prototype pcToMoving icon
        icon: "M3 8l9-4 9 4-9 4-9-4zM3 8v8l9 4 9-4V8",
      },
      {
        label: "셋업 설정",
        href: "/staff/setup",
        module: "setup",
        built: false,
        // gear/settings: prototype pcToSetup icon
        icon: "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2",
      },
    ],
  },
  {
    label: "설정",
    items: [
      {
        label: "계정·권한",
        href: "/staff/staff-management",
        module: "accounts",
        built: false,
        // person + shield or user circle
        icon: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 20a8 8 0 0 1 16 0",
      },
      {
        label: "협력업체",
        href: "/staff/vendor-management",
        module: "vendors",
        built: true,
        // briefcase / building
        icon: "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M12 12v4M10 14h4",
      },
    ],
  },
];
