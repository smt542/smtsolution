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
  useCreateVendorCategory: vi.fn(),
  useRenameVendorCategory: vi.fn(),
  useDeleteVendorCategory: vi.fn(),
}));

vi.mock("@/hooks/reactquery/vendors", () => ({
  useVendors: vi.fn(),
  useCreateVendor: vi.fn(),
  useUpdateVendor: vi.fn(),
  useDeleteVendor: vi.fn(),
  useVendorAttachments: vi.fn(),
  useUploadVendorAttachment: vi.fn(),
  useDeleteVendorAttachment: vi.fn(),
}));

vi.mock("@/hooks/reactquery/auth", () => ({
  useMe: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import VendorManagementPage from "./page";
import {
  useVendorCategories,
  useCreateVendorCategory,
  useRenameVendorCategory,
  useDeleteVendorCategory,
} from "@/hooks/reactquery/vendorCategories";
import {
  useVendors,
  useCreateVendor,
  useUpdateVendor,
  useDeleteVendor,
  useVendorAttachments,
  useUploadVendorAttachment,
  useDeleteVendorAttachment,
} from "@/hooks/reactquery/vendors";
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
  vi.mocked(useVendorCategories).mockReturnValue({ data: mockCategories, isLoading: false } as any);
  vi.mocked(useVendors).mockReturnValue({ data: mockVendors, isLoading: false } as any);
  vi.mocked(useVendorAttachments).mockReturnValue({ data: mockAttachments, isLoading: false } as any);
  vi.mocked(useMe).mockReturnValue({ data: { orgId: 10 } } as any);
  vi.mocked(useCreateVendorCategory).mockReturnValue(mockMutate as any);
  vi.mocked(useRenameVendorCategory).mockReturnValue(mockMutate as any);
  vi.mocked(useDeleteVendorCategory).mockReturnValue(mockMutate as any);
  vi.mocked(useCreateVendor).mockReturnValue(mockMutate as any);
  vi.mocked(useUpdateVendor).mockReturnValue(mockMutate as any);
  vi.mocked(useDeleteVendor).mockReturnValue(mockMutate as any);
  vi.mocked(useUploadVendorAttachment).mockReturnValue(mockMutate as any);
  vi.mocked(useDeleteVendorAttachment).mockReturnValue(mockMutate as any);
}

describe("VendorManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate.mutateAsync.mockResolvedValue({});
    setupMocks();
  });

  it('renders sidebar with "전체" and sample categories', () => {
    render(<VendorManagementPage />);
    // "전체" only appears in sidebar
    expect(screen.getByText("전체")).toBeInTheDocument();
    // categories appear in sidebar — use getAllByText since "전기" may also appear in the vendor table column
    expect(screen.getAllByText("전기").length).toBeGreaterThan(0);
    expect(screen.getAllByText("수도").length).toBeGreaterThan(0);
  });

  it("renders vendor list with sample vendors", () => {
    render(<VendorManagementPage />);
    expect(screen.getByText("한국전력")).toBeInTheDocument();
    expect(screen.getByText("서울수도")).toBeInTheDocument();
  });

  it("selecting a category calls useVendors with that categoryId", async () => {
    render(<VendorManagementPage />);
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
    render(<VendorManagementPage />);
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
    render(<VendorManagementPage />);
    expect(screen.getByRole("button", { name: /업체 추가/ })).toBeInTheDocument();
  });

  it("clicking ＋ 업체 추가 opens the modal", async () => {
    render(<VendorManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: /업체 추가/ }));
    await waitFor(() => {
      expect(screen.getByText("업체 추가")).toBeInTheDocument();
    });
  });

  it("업체명 is required — submitting empty name shows validation error", async () => {
    const user = userEvent.setup();
    render(<VendorManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: /업체 추가/ }));
    await waitFor(() => expect(screen.getByText("업체 추가")).toBeInTheDocument());

    // Submit without filling name — use the modal's submit button (exact text "추가")
    const submitBtn = screen.getByRole("button", { name: "추가" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("업체명을 입력해 주세요")).toBeInTheDocument();
    });
  });

  it("clicking a vendor row opens edit modal", async () => {
    render(<VendorManagementPage />);
    fireEvent.click(screen.getByText("한국전력"));
    await waitFor(() => {
      expect(screen.getByText("업체 수정")).toBeInTheDocument();
    });
  });

  it("edit modal shows a file input for 계약서 사진", async () => {
    render(<VendorManagementPage />);
    fireEvent.click(screen.getByText("한국전력"));
    await waitFor(() => {
      expect(screen.getByText("업체 수정")).toBeInTheDocument();
    });
    // File input for contract image upload must be present
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput).toHaveAttribute("accept", "image/*");
  });

  it("double-clicking a category label shows rename input and submitting calls mutateAsync", async () => {
    const renameMutate = vi.fn().mockResolvedValue({});
    vi.mocked(useRenameVendorCategory).mockReturnValue({ mutateAsync: renameMutate, isPending: false } as any);

    render(<VendorManagementPage />);

    // Double-click the "전기" category button to enter rename mode
    const sidebarButtons = screen.getAllByRole("button");
    const dengiBtn = sidebarButtons.find((b) => b.textContent?.startsWith("전기"));
    expect(dengiBtn).toBeDefined();
    fireEvent.dblClick(dengiBtn!);

    // Rename input should appear
    const renameInput = await screen.findByRole("textbox", { name: "구분 이름 변경" });
    expect(renameInput).toBeInTheDocument();
    expect((renameInput as HTMLInputElement).value).toBe("전기");

    // Clear and type a new name, then press Enter
    fireEvent.change(renameInput, { target: { value: "전기설비" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    await waitFor(() => {
      expect(renameMutate).toHaveBeenCalledWith({ id: 1, label: "전기설비" });
    });
  });
});
