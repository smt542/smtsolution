"use client";
import React, { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { VendorCategorySidebar } from "./VendorCategorySidebar";
import { VendorList } from "./VendorList";
import { VendorFormModal } from "./VendorFormModal";
import styles from "./VendorManagement.module.css";
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const onDelete = async (att: VendorAttachment) => {
    try {
      await deleteAtt.mutateAsync({ id: att.id, path: att.fileUrl, vendorId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return <>{children({ attachments, onUpload, onDelete })}</>;
}

export function VendorManagementSection() {
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
  const deleteCategory = useDeleteVendorCategory();
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const selectedCategoryLabel = selectedCategoryId === null
    ? "전체"
    : (categories.find((category) => category.id === selectedCategoryId)?.label ?? "미분류");

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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRenameCategory = async (id: number, label: string) => {
    try {
      await renameCategory.mutateAsync({ id, label });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await deleteCategory.mutateAsync(id);
      if (selectedCategoryId === id) setSelectedCategoryId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDeleteVendor = async (id: number) => {
    try {
      await deleteVendor.mutateAsync(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  return (
    <div className={styles.workspace}>
      <VendorCategorySidebar
        categories={categories}
        allVendors={allVendors}
        selectedId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
        onAddCategory={handleAddCategory}
        onRenameCategory={handleRenameCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      {/* Right content */}
      <section className={styles.panel} aria-label="협력업체 목록">
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>{selectedCategoryLabel}</h2>
          <span className={styles.countBadge}>{vendors.length}곳</span>
          <span className={styles.panelSpacer} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="업체명·담당자·연락처 검색"
            aria-label="협력업체 검색"
            className={styles.search}
          />
          <button type="button" className={styles.addButton} onClick={openCreate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            업체 추가
          </button>
        </div>

        <VendorList
          vendors={vendors}
          categories={categories}
          isLoading={vendorsLoading || catLoading}
          onRowClick={openEdit}
        />
      </section>

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
              onDeleteVendor={handleDeleteVendor}
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
          defaultCategoryId={selectedCategoryId}
          categories={categories}
          onSubmit={handleSubmit}
          isPending={createVendor.isPending || updateVendor.isPending}
        />
      )}
    </div>
  );
}
