import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

// Mock hooks
vi.mock("@/hooks/reactquery/vendorCategories", () => ({
  useVendorCategories: vi.fn(),
}));

vi.mock("@/hooks/reactquery/vendors", () => ({
  useVendors: vi.fn(),
  useCreateVendor: vi.fn(),
  useUpdateVendor: vi.fn(),
  useDeleteVendor: vi.fn(),
}));

vi.mock("@/hooks/reactquery/attachments", () => ({
  useAttachments: vi.fn(),
  useUploadAttachments: vi.fn(),
  useDeleteAttachment: vi.fn(),
  useAttachmentSignedUrls: (attachments: Array<{ id: number }>) =>
    attachments.map((attachment) => ({ attachment, url: null, error: null, isPending: false })),
}));

vi.mock("@/hooks/reactquery/auth", () => ({
  useMe: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { VendorManagementSection } from "./VendorManagementSection";
import { useVendorCategories } from "@/hooks/reactquery/vendorCategories";
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor } from "@/hooks/reactquery/vendors";
import { useAttachments, useUploadAttachments, useDeleteAttachment } from "@/hooks/reactquery/attachments";
import { useMe } from "@/hooks/reactquery/auth";

const mockCategories = [
  { id: 1, orgId: 10, label: "전기", sortOrder: 0 },
  { id: 2, orgId: 10, label: "수도", sortOrder: 1 },
];

const mockVendors = [
  { id: 10, orgId: 10, name: "한국전력", phone: "02-1234-5678", bankAccount: null, memo: null, categoryId: 1 },
  { id: 11, orgId: 10, name: "서울수도", phone: "02-8765-4321", bankAccount: null, memo: null, categoryId: 2 },
];

const mockAttachments = [
  { id: 100, orgId: 10, entityType: "vendor", entityId: 10, kind: "contract", fileUrl: "org/vendor/10/file.jpg", fileName: "계약서.jpg", createdAt: "2024-01-01" },
];

const mockMutate = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };

function setupMocks() {
  vi.mocked(useVendorCategories).mockReturnValue({ data: mockCategories, isLoading: false } as unknown as ReturnType<typeof useVendorCategories>);
  vi.mocked(useVendors).mockReturnValue({ data: mockVendors, isLoading: false } as unknown as ReturnType<typeof useVendors>);
  vi.mocked(useAttachments).mockReturnValue({ data: mockAttachments, isLoading: false } as unknown as ReturnType<typeof useAttachments>);
  vi.mocked(useMe).mockReturnValue({ data: { orgId: 10 } } as unknown as ReturnType<typeof useMe>);
  vi.mocked(useCreateVendor).mockReturnValue(mockMutate as unknown as ReturnType<typeof useCreateVendor>);
  vi.mocked(useUpdateVendor).mockReturnValue(mockMutate as unknown as ReturnType<typeof useUpdateVendor>);
  vi.mocked(useDeleteVendor).mockReturnValue(mockMutate as unknown as ReturnType<typeof useDeleteVendor>);
  vi.mocked(useUploadAttachments).mockReturnValue(mockMutate as unknown as ReturnType<typeof useUploadAttachments>);
  vi.mocked(useDeleteAttachment).mockReturnValue(mockMutate as unknown as ReturnType<typeof useDeleteAttachment>);
}

describe("VendorManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate.mutateAsync.mockResolvedValue({});
    setupMocks();
  });

  it('renders sidebar with "전체" and sample categories', () => {
    render(<VendorManagementSection />);
    expect(screen.getByLabelText("협력업체 구분")).toBeInTheDocument();
    expect(screen.getByLabelText("협력업체 목록")).toBeInTheDocument();
    expect(screen.getAllByText("전체")).toHaveLength(2);
    expect(screen.getByText("2곳")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "협력업체 검색" })).toHaveAttribute(
      "placeholder",
      "업체명·담당자·연락처 검색",
    );
    // categories appear in sidebar — use getAllByText since "전기" may also appear in the vendor table column
    expect(screen.getAllByText("전기").length).toBeGreaterThan(0);
    expect(screen.getAllByText("수도").length).toBeGreaterThan(0);
  });

  it("renders vendor list with sample vendors", () => {
    render(<VendorManagementSection />);
    expect(screen.getByText("한국전력")).toBeInTheDocument();
    expect(screen.getByText("서울수도")).toBeInTheDocument();
  });

  it("selecting a category calls useVendors with that categoryId", async () => {
    render(<VendorManagementSection />);
    // Click the sidebar button for "전기" — find via SidebarList buttons (ul > li > button)
    const sidebarButtons = screen.getAllByRole("button");
    const dengiBtn = sidebarButtons.find((b) => b.textContent?.startsWith("전기"));
    expect(dengiBtn).toBeDefined();
    fireEvent.click(dengiBtn!);
    await waitFor(() => {
      const calls = vi.mocked(useVendors).mock.calls;
      expect(calls.some((c) => c[0] === 1)).toBe(true);
    });
  });

  it('selecting "전체" calls useVendors with undefined categoryId', async () => {
    render(<VendorManagementSection />);
    // Click 전기 first to set categoryId, then 전체 to clear it
    const sidebarButtons = screen.getAllByRole("button");
    const dengiBtn = sidebarButtons.find((b) => b.textContent?.startsWith("전기"));
    fireEvent.click(dengiBtn!);
    fireEvent.click(screen.getByText("전체"));
    await waitFor(() => {
      const calls = vi.mocked(useVendors).mock.calls;
      expect(calls.some((c) => c[0] === undefined)).toBe(true);
    });
  });

  it('renders ＋ 업체 추가 button', () => {
    render(<VendorManagementSection />);
    expect(screen.getByRole("button", { name: /업체 추가/ })).toBeInTheDocument();
  });

  it("clicking ＋ 업체 추가 opens the modal", async () => {
    render(<VendorManagementSection />);
    fireEvent.click(screen.getByRole("button", { name: /업체 추가/ }));
    await waitFor(() => {
      const dialog = screen.getByRole("dialog", { name: "업체 추가" });
      expect(dialog).toBeInTheDocument();
      expect(dialog.parentElement).toHaveClass("z-[320]");
    });
  });

  it("선택한 구분에서 업체 추가를 열면 해당 구분을 기본 선택한다", async () => {
    render(<VendorManagementSection />);
    const categoryButton = screen.getAllByRole("button").find((button) => button.textContent?.startsWith("전기"));
    fireEvent.click(categoryButton!);
    fireEvent.click(screen.getByRole("button", { name: "업체 추가" }));

    expect(await screen.findByRole("combobox", { name: "구분" })).toHaveTextContent("전기");
  });

  it("업체 추가 모달은 구분 선택 전 입력 필드를 숨기고 커스텀 목록에서 구분을 선택한다", async () => {
    const user = userEvent.setup();
    render(<VendorManagementSection />);
    await user.click(screen.getByRole("button", { name: /업체 추가/ }));

    expect(screen.getByText("구분을 먼저 선택하세요.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("업체명")).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "구분" }));
    expect(screen.getByRole("listbox", { name: "구분 선택" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "전기" }));

    expect(screen.queryByText("구분을 먼저 선택하세요.")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("업체명")).toBeInTheDocument();
  });

  it("업체명 is required — submitting empty name shows validation error", async () => {
    const user = userEvent.setup();
    render(<VendorManagementSection />);
    fireEvent.click(screen.getByRole("button", { name: /업체 추가/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "업체 추가" })).toBeInTheDocument());

    await user.click(screen.getByRole("combobox", { name: "구분" }));
    await user.click(screen.getByRole("option", { name: "전기" }));

    // Submit without filling name — use the modal's submit button (exact text "추가")
    const submitBtn = screen.getByRole("button", { name: "추가" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("업체명을 입력해 주세요")).toBeInTheDocument();
    });
  });

  it("clicking a vendor row opens edit modal", async () => {
    render(<VendorManagementSection />);
    fireEvent.click(screen.getByText("한국전력"));
    await waitFor(() => {
      expect(screen.getByText("업체 수정")).toBeInTheDocument();
    });
  });

  it("edit modal shows a file input for 계약서 사진", async () => {
    render(<VendorManagementSection />);
    fireEvent.click(screen.getByText("한국전력"));
    await waitFor(() => {
      expect(screen.getByText("업체 수정")).toBeInTheDocument();
    });
    // File input for contract image upload must be present
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(fileInput).toHaveAttribute("multiple");
  });

  it("new vendor photos are uploaded after the vendor is created", async () => {
    const user = userEvent.setup();
    const createdVendor = {
      id: 30,
      orgId: 10,
      name: "새 업체",
      phone: null,
      bankAccount: null,
      memo: null,
      categoryId: 1,
    };
    const createMutate = vi.fn().mockResolvedValue(createdVendor);
    const uploadMutate = vi.fn().mockResolvedValue({ succeeded: [{ file: new File([], "ok.png") }], failed: [] });
    vi.mocked(useCreateVendor).mockReturnValue({ mutateAsync: createMutate, isPending: false } as unknown as ReturnType<typeof useCreateVendor>);
    vi.mocked(useUploadAttachments).mockReturnValue({ mutateAsync: uploadMutate, isPending: false } as unknown as ReturnType<typeof useUploadAttachments>);

    render(<VendorManagementSection />);
    await user.click(screen.getByRole("button", { name: /업체 추가/ }));
    await user.click(screen.getByRole("combobox", { name: "구분" }));
    await user.click(screen.getByRole("option", { name: "전기" }));
    await user.type(screen.getByPlaceholderText("업체명"), "새 업체");

    const photo = new File(["photo"], "contract.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("계약서 사진 선택"), photo);
    await user.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({ name: "새 업체", categoryId: 1, orgId: 10 }));
      expect(uploadMutate).toHaveBeenCalledWith({
        entityType: "vendor",
        entityId: 30,
        orgId: 10,
        kind: "contract",
        fileType: "image",
        files: [photo],
      });
    });
  });

  it("renders categories as fixed filters without add, rename, or delete controls", () => {
    render(<VendorManagementSection />);
    expect(screen.queryByRole("button", { name: "구분 추가" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /구분 삭제/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "구분 이름 변경" })).not.toBeInTheDocument();
  });

  it("duplicate name: clicking the SECOND vendor with the same name opens the modal for the SECOND vendor", async () => {
    const dupVendors = [
      { id: 20, orgId: 10, name: "중복업체", phone: "02-0000-0001", bankAccount: null, memo: null, categoryId: 1 },
      { id: 21, orgId: 10, name: "중복업체", phone: "02-0000-0002", bankAccount: null, memo: null, categoryId: 2 },
    ];
    vi.mocked(useVendors).mockReturnValue({ data: dupVendors, isLoading: false } as unknown as ReturnType<typeof useVendors>);
    vi.mocked(useAttachments).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useAttachments>);

    render(<VendorManagementSection />);

    // Both rows have the same name — get all cells with that text and click the second one
    const cells = screen.getAllByText("중복업체");
    expect(cells.length).toBe(2);
    fireEvent.click(cells[1]!);

    await waitFor(() => {
      expect(screen.getByText("업체 수정")).toBeInTheDocument();
    });

    // The edit modal should show the second vendor's phone
    expect(screen.getByDisplayValue("02-0000-0002")).toBeInTheDocument();
  });

  it("vendor delete: opening edit modal, clicking 삭제, confirming calls useDeleteVendor().mutateAsync", async () => {
    const deleteMutate = vi.fn().mockResolvedValue({});
    vi.mocked(useDeleteVendor).mockReturnValue({ mutateAsync: deleteMutate, isPending: false } as unknown as ReturnType<typeof useDeleteVendor>);

    render(<VendorManagementSection />);

    // Open edit modal for first vendor
    fireEvent.click(screen.getByText("한국전력"));
    await waitFor(() => expect(screen.getByText("업체 수정")).toBeInTheDocument());

    // Click the 삭제 button in the modal footer
    const deleteBtn = screen.getByRole("button", { name: "삭제" });
    fireEvent.click(deleteBtn);

    // Confirm dialog appears
    await waitFor(() => expect(screen.getByText(/삭제하면 되돌릴 수 없어요/)).toBeInTheDocument());

    // Click confirm 삭제
    const confirmBtns = screen.getAllByRole("button", { name: "삭제" });
    const confirmBtn = confirmBtns[confirmBtns.length - 1]!;
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith(10);
    });
  });

});
