import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mutateAsync } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/occupancies", () => ({
  useTenantList: vi.fn(),
  useOccupancies: vi.fn(),
}));
vi.mock("@/hooks/reactquery/accounts", () => ({ useAccounts: vi.fn() }));
vi.mock("@/hooks/reactquery/quickMessages", () => ({
  useQuickMessages: vi.fn(),
}));
vi.mock("@/hooks/reactquery/messaging", () => ({
  useSendMessages: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { useAccounts } from "@/hooks/reactquery/accounts";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useOccupancies,
  useTenantList,
} from "@/hooks/reactquery/occupancies";
import { useQuickMessages } from "@/hooks/reactquery/quickMessages";
import { useSendMessages } from "@/hooks/reactquery/messaging";
import { MessagingComposer } from "./MessagingComposer";

const buildings = [
  {
    id: 7,
    orgId: 1,
    code: "B-001",
    name: "그린빌라",
    address: null,
    typeId: null,
    ownerName: "이건물주",
    ownerPhone: "010-7000-0000",
    entrancePassword: null,
    managerUserId: null,
    meterUserId: null,
    cleaningUserId: null,
    facilities: {},
    memo: null,
  },
];

const tenants = [
  {
    unitId: 11,
    occupancyId: 101,
    unitNo: "101호",
    tenantName: "김입주",
    roomTypeLabel: "원룸",
    residentCount: 1,
    moveInDate: "2026-01-01",
    isVacant: false,
    isOverdue: false,
  },
];

const accounts = [
  {
    userId: "staff-1",
    username: "staff",
    fullName: "박직원",
    phone: "010-9000-0000",
    phoneSub: null,
    role: "staff",
    staffType: "manager_staff",
    affiliation: null,
    isActive: true,
    permissions: [],
    roleLabels: [],
  },
];

const confirmSpy = vi.spyOn(window, "confirm");

beforeEach(() => {
  vi.clearAllMocks();
  confirmSpy.mockReturnValue(true);
  mutateAsync.mockResolvedValue({ logId: 55, count: 1 });
  vi.mocked(useBuildings).mockReturnValue({
    data: buildings,
    isLoading: false,
  } as unknown as ReturnType<typeof useBuildings>);
  vi.mocked(useTenantList).mockReturnValue({
    data: tenants,
    isLoading: false,
  } as unknown as ReturnType<typeof useTenantList>);
  vi.mocked(useOccupancies).mockReturnValue({
    data: [
      {
        id: 101,
        unitId: 11,
        tenantName: "김입주",
        payerName: "김입주",
        phone: "010-1000-0000",
        phone2: null,
        phone3: null,
        vehicleNo: null,
        residentCount: 1,
        roomTypeId: 1,
        moveInDate: "2026-01-01",
        moveOutDate: null,
        status: "occupied",
        billingEnabled: true,
        printEnabled: true,
        lateFeeEnabled: true,
        singlePrint: false,
        billingNote: null,
        settlementNote: null,
        facilityNote: null,
      },
    ],
    isLoading: false,
  } as unknown as ReturnType<typeof useOccupancies>);
  vi.mocked(useAccounts).mockReturnValue({
    data: accounts,
    isLoading: false,
  } as unknown as ReturnType<typeof useAccounts>);
  vi.mocked(useQuickMessages).mockReturnValue({
    data: [
      {
        id: 3,
        orgId: 1,
        title: "점검 안내",
        body: "오늘 소방 점검이 있습니다.",
        sortOrder: 0,
      },
    ],
  } as unknown as ReturnType<typeof useQuickMessages>);
  vi.mocked(useSendMessages).mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useSendMessages>);
});

describe("MessagingComposer", () => {
  it("SMS 채널과 세대·건물주·직원 수신처를 표시하고 선택 수를 갱신", () => {
    render(<MessagingComposer />);

    expect(screen.getByText("SMS")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "세대" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "건물주" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "직원" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("건물 선택"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByLabelText(/101호 · 김입주/));
    expect(screen.getAllByText("1명").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText(/이건물주/));
    fireEvent.click(screen.getByLabelText(/박직원/));
    expect(screen.getAllByText("3명").length).toBeGreaterThan(0);
  });

  it("본문을 입력하고 자주 보내는 문구를 삽입", () => {
    render(<MessagingComposer />);

    fireEvent.change(screen.getByLabelText("본문"), {
      target: { value: "안녕하세요." },
    });
    fireEvent.change(screen.getByLabelText("자주 보내는 문자"), {
      target: { value: "3" },
    });

    expect(screen.getByLabelText("본문")).toHaveValue(
      "안녕하세요.\n오늘 소방 점검이 있습니다.",
    );
  });

  it("preset 초기값을 반영하고 확인 후 유효 수신처만 발송", async () => {
    const onSent = vi.fn();
    render(
      <MessagingComposer
        preset={{
          context: "독촉",
          body: "미납 관리비를 확인해 주세요.",
          recipients: [
            {
              name: "김입주",
              phone: "010-1000-0000",
              unitNo: "101호",
              kind: "tenant",
              ref: { occupancyId: 101 },
            },
            { name: "연락처없음", phone: null, kind: "tenant" },
          ],
        }}
        onSent={onSent}
      />,
    );

    expect(screen.getByLabelText("본문")).toHaveValue(
      "미납 관리비를 확인해 주세요.",
    );
    expect(screen.getAllByText("1명").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "발송" }));

    await waitFor(() =>
      expect(confirmSpy).toHaveBeenCalledWith("1명에게 발송하시겠습니까?"),
    );
    expect(mutateAsync).toHaveBeenCalledWith({
      channel: "sms",
      body: "미납 관리비를 확인해 주세요.",
      context: "독촉",
      recipients: [
        {
          name: "김입주",
          phone: "010-1000-0000",
          unitNo: "101호",
          kind: "tenant",
          ref: { occupancyId: 101 },
        },
      ],
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("발송(임시) 완료 · 1명"),
    );
    expect(onSent).toHaveBeenCalledWith({ logId: 55, count: 1 });
  });

  it("수신처 또는 본문이 비어 있으면 안내하고 발송하지 않음", () => {
    render(<MessagingComposer />);

    fireEvent.click(screen.getByRole("button", { name: "발송" }));
    expect(toast.info).toHaveBeenCalledWith("수신처를 선택해 주세요.");

    fireEvent.click(screen.getByLabelText(/박직원/));
    fireEvent.click(screen.getByRole("button", { name: "발송" }));
    expect(toast.info).toHaveBeenCalledWith("본문을 입력해 주세요.");
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
