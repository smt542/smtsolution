"use client";
import React, { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button, SearchBar } from "@/components/common";
import { VendorCategorySidebar } from "./components/VendorCategorySidebar";
import { VendorList } from "./components/VendorList";
import { VendorFormModal } from "./components/VendorFormModal";
import {
  useVendorCategories,
  useCreateVendorCategory,
  useRenameVendorCategory,
} from "@/hooks/reactquery/vendorCategories";
import {
  useVendors,
  useCreateVendor,
  useUpdateVendor,
  useVendorAttachments,
  useUploadVendorAttachment,
  useDeleteVendorAttachment,
} from "@/hooks/reactquery/vendors";
import { useMe } from "@/hooks/reactquery/auth";
import { vendorSchema } from "@/components/forms/schema/vendor";
import type { Vendor, VendorAttachment } from "@/hooks/reactquery/vendors";

type VendorFormOutput = z.output<typeof vendorSchema>;

// Inner component that loads attachments only when editing an existing vendor
function AttachmentLoader({
  vendorId,
  children,
}: {
  vendorId: number;
  children: (data: {
    attachments: VendorAttachment[];
    onUpload: (file: File) => Promise<void>;
    onDelete: (att: VendorAttachment) => Promise<void>;
  }) => React.ReactNode;
}) {
  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data: attachments = [] } = useVendorAttachments(vendorId);
  const upload = useUploadVendorAttachment();
  const deleteAtt = useDeleteVendorAttachment();

  const onUpload = async (file: File) => {
    if (!orgId) { toast.error("인증 정보가 없습니다"); return; }
    try {
      await upload.mutateAsync({ vendorId, orgId, file });
    } catch (e: any) {
      toast.error(e.message ?? "파일 업로드 실패");
    }
  };

  const onDelete = async (att: VendorAttachment) => {
    try {
      await deleteAtt.mutateAsync({ id: att.id, path: att.fileUrl, vendorId });
    } catch (e: any) {
      toast.error(e.message ?? "파일 삭제 실패");
    }
  };

  return <>{children({ attachments, onUpload, onDelete })}</>;
}

export default function VendorManagementPage() {
  const { data: me } = useMe();
  const orgId = me?.orgId;

  const { data: categories = [], isLoading: catLoading } = useVendorCategories();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // All vendors (no filter) for sidebar counts
  const { data: allVendors = [] } = useVendors();
  // Filtered vendors for the list
  const { data: vendors = [], isLoading: vendorsLoading } = useVendors(
    selectedCategoryId ?? undefined,
    search || undefined
  );

  const createCategory = useCreateVendorCategory();
  const renameCategory = useRenameVendorCategory();
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const openCreate = () => {
    setEditingVendor(null);
    setModalOpen(true);
  };

  const openEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingVendor(null);
  };

  const handleAddCategory = async (label: string) => {
    if (!orgId) { toast.error("인증 정보가 없습니다"); return; }
    try {
      await createCategory.mutateAsync({ orgId, label });
    } catch (e: any) {
      toast.error(e.message ?? "구분 추가 실패");
    }
  };

  const handleRenameCategory = async (id: number, label: string) => {
    try {
      await renameCategory.mutateAsync({ id, label });
    } catch (e: any) {
      toast.error(e.message ?? "구분 이름 변경 실패");
    }
  };

  const handleSubmit = async (values: VendorFormOutput) => {
    if (!orgId) { toast.error("인증 정보가 없습니다"); return; }
    try {
      if (editingVendor) {
        await updateVendor.mutateAsync({ id: editingVendor.id, input: { ...values, orgId } });
      } else {
        await createVendor.mutateAsync({ ...values, orgId });
      }
    } catch (e: any) {
      toast.error(e.message ?? "저장 실패");
      throw e;
    }
  };

  return (
    <div className="flex min-h-screen gap-6 p-6">
      {/* Left sidebar */}
      <aside className="w-52 shrink-0">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-t4">구분</h2>
        <VendorCategorySidebar
          categories={categories}
          allVendors={allVendors}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          onAddCategory={handleAddCategory}
          onRenameCategory={handleRenameCategory}
        />
      </aside>

      {/* Right content */}
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-t1">업체 관리</h1>
          <Button variant="primary" onClick={openCreate}>
            ＋ 업체 추가
          </Button>
        </div>

        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="업체명·연락처 검색"
        />

        <VendorList
          vendors={vendors}
          categories={categories}
          isLoading={vendorsLoading || catLoading}
          onRowClick={openEdit}
        />
      </div>

      {/* Modal */}
      {editingVendor ? (
        <AttachmentLoader vendorId={editingVendor.id}>
          {({ attachments, onUpload, onDelete }) => (
            <VendorFormModal
              open={modalOpen}
              onClose={closeModal}
              editing={editingVendor}
              categories={categories}
              onSubmit={handleSubmit}
              isPending={createVendor.isPending || updateVendor.isPending}
              attachments={attachments}
              onUploadAttachment={onUpload}
              onDeleteAttachment={onDelete}
            />
          )}
        </AttachmentLoader>
      ) : (
        <VendorFormModal
          open={modalOpen}
          onClose={closeModal}
          editing={null}
          categories={categories}
          onSubmit={handleSubmit}
          isPending={createVendor.isPending || updateVendor.isPending}
        />
      )}
    </div>
  );
}
