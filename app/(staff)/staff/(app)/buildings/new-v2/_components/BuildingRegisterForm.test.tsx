import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type VendorAssignments = Record<string, {
  fields: Record<string, string>;
  memo: string;
  pendingFiles: File[];
}>;

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  upload: vi.fn(),
  deleteAttachment: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: mocks.push }),
}));
vi.mock("@/components/common/ConfirmProvider", () => ({ useConfirm: () => vi.fn().mockResolvedValue(true) }));
vi.mock("@/hooks/common", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/common")>();
  return {
    ...actual,
    useAppToast: () => ({ success: mocks.success, warning: mocks.warning, error: mocks.error }),
  };
});
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: () => ({ data: { orgId: 9 } }) }));
vi.mock("@/hooks/reactquery/buildingTypes", () => ({ useBuildingTypes: () => ({ data: [] }) }));
vi.mock("@/hooks/reactquery/buildings", () => ({
  emptyFacilities: () => ({}),
  useSaveBuilding: () => ({ mutateAsync: mocks.save, isPending: false }),
  useStaffOptions: () => ({ data: [] }),
  useBuildingFull: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@/hooks/reactquery/attachments", () => ({
  useAttachmentsByEntities: () => ({ data: [] }),
  useUploadAttachments: () => ({ mutateAsync: mocks.upload, isPending: false }),
  useDeleteAttachment: () => ({ mutateAsync: mocks.deleteAttachment, isPending: false }),
}));
vi.mock("./RegisterHeader", () => ({
  RegisterHeader: ({ onSave }: { onSave: () => void }) => <button onClick={onSave}>저장</button>,
}));
vi.mock("./sections/BasicInfoSection", () => ({
  BasicInfoSection: ({ patch }: { patch: (value: { name: string; address: string }) => void }) => (
    <button onClick={() => patch({ name: "테스트 건물", address: "서울" })}>기본정보 입력</button>
  ),
}));
vi.mock("./sections/VendorAssignmentSection", () => ({
  VendorAssignmentSection: ({ value, patch }: {
    value: { vendors: VendorAssignments };
    patch: (value: { vendors: VendorAssignments }) => void;
  }) => (
    <button onClick={() => patch({
      vendors: {
        ...value.vendors,
        cleaning: {
          ...value.vendors.cleaning,
          fields: { 업체명: "청소 업체" },
          pendingFiles: [new File(["photo"], "contract.png", { type: "image/png" })],
        },
      },
    })}>
      사진 입력
    </button>
  ),
}));
vi.mock("./sections/ReserveFundSection", () => ({ ReserveFundSection: () => null }));
vi.mock("./sections/OwnerInfoSection", () => ({ OwnerInfoSection: () => null }));
vi.mock("./sections/ExtraInfoSection", () => ({ ExtraInfoSection: () => null }));
vi.mock("./sections/BuildingMemoSection", () => ({ BuildingMemoSection: () => null }));

import { BuildingRegisterForm } from "./BuildingRegisterForm";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({
    buildingId: 42,
    vendors: [{ clientKey: "register-cleaning", id: 99 }],
  });
  mocks.upload.mockImplementation(async ({ files }: { files: File[] }) => ({
    succeeded: files.map((file) => ({ file, attachment: {} })),
    failed: [],
  }));
});

describe("BuildingRegisterForm attachments", () => {
  it("신규 건물 저장 결과의 실제 업체 ID로 사진을 업로드한다", async () => {
    render(<BuildingRegisterForm />);
    fireEvent.click(screen.getByText("기본정보 입력"));
    fireEvent.click(screen.getByText("사진 입력"));
    fireEvent.click(screen.getByText("저장"));

    await waitFor(() => expect(mocks.upload).toHaveBeenCalled());
    expect(mocks.upload).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "building_vendor",
      entityId: 99,
      orgId: 9,
      fileType: "image",
    }));
    expect(mocks.replace).toHaveBeenCalledWith("/staff/buildings/42");
  });

  it("부분 실패 후 실패 파일만 유지하고 같은 entity ID로 재시도한다", async () => {
    mocks.upload
      .mockImplementationOnce(async ({ files }: { files: File[] }) => ({
        succeeded: [],
        failed: files.map((file) => ({ file, error: new Error("failed") })),
      }))
      .mockImplementationOnce(async ({ files }: { files: File[] }) => ({
        succeeded: files.map((file) => ({ file, attachment: {} })),
        failed: [],
      }));
    render(<BuildingRegisterForm />);
    fireEvent.click(screen.getByText("기본정보 입력"));
    fireEvent.click(screen.getByText("사진 입력"));
    fireEvent.click(screen.getByText("저장"));

    await waitFor(() => expect(mocks.warning).toHaveBeenCalled());
    expect(mocks.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("저장"));

    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(2));
    expect(mocks.save.mock.calls[1][0]).toEqual(expect.objectContaining({ id: 42 }));
    expect(mocks.save.mock.calls[1][0].vendors).toEqual([
      expect.objectContaining({ id: 99 }),
    ]);
    expect(mocks.upload.mock.calls[1][0]).toEqual(expect.objectContaining({ entityId: 99 }));
    expect(mocks.replace).toHaveBeenCalledWith("/staff/buildings/42");
  });
});
