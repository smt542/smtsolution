import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

import MobileAsNewLoading from "./(partner)/partner/(app)/mobile-as-new/loading";
import MobileBuildingLoading from "./(partner)/partner/(app)/mobile-building/loading";
import MobileMsNewLoading from "./(partner)/partner/(app)/mobile-ms-new/loading";
import MobileTenantLoading from "./(partner)/partner/(app)/mobile-tenant/loading";
import ResidentBillLoading from "./(resident)/resident/(app)/bill/loading";
import ResidentNoticeLoading from "./(resident)/resident/(app)/notice/loading";
import StaffBillLoading from "./(staff)/staff/(app)/bill/loading";
import LongTermRepairLoading from "./(staff)/staff/(app)/long-term-repair/loading";
import MessagingLoading from "./(staff)/staff/(app)/messaging/loading";
import NoticesLoading from "./(staff)/staff/(app)/notices/loading";
import OverdueLoading from "./(staff)/staff/(app)/overdue/loading";

const boundaries: Array<[ComponentType, string]> = [
  [MobileAsNewLoading, "신규 접수 화면 불러오는 중"],
  [MobileBuildingLoading, "건물 화면 불러오는 중"],
  [MobileMsNewLoading, "이사정산 화면 불러오는 중"],
  [MobileTenantLoading, "입주자 화면 불러오는 중"],
  [ResidentBillLoading, "관리비 내역 불러오는 중"],
  [ResidentNoticeLoading, "공지사항 불러오는 중"],
  [StaffBillLoading, "고지서 화면 불러오는 중"],
  [LongTermRepairLoading, "장기수선충당금 화면 불러오는 중"],
  [MessagingLoading, "메시지 화면 불러오는 중"],
  [NoticesLoading, "공지사항 화면 불러오는 중"],
  [OverdueLoading, "미납 관리 화면 불러오는 중"],
];

describe("route loading 경계", () => {
  it.each(boundaries)("접근 가능한 서버 라우트 fallback을 제공한다: %s", (Loading, label) => {
    const view = render(<Loading />);

    expect(screen.getByRole("status", { name: label })).toBeInTheDocument();
    view.unmount();
  });
});
