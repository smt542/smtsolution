"use client";
import React, { useState } from "react";
import { z } from "zod";
import { Input } from "@/components/common";
import { PlusIcon } from "@/components/icons";
import { VendorCategorySidebar } from "./VendorCategorySidebar";
import { VendorList } from "./VendorList";
import { VendorFormModal } from "./VendorFormModal";
import { vendorClasses } from "./vendorClasses";
import { useVendorCategories } from "@/hooks/reactquery/vendorCategories";
import {
  useVendors,
  useCreateVendor,
  useUpdateVendor,
  useDeleteVendor,
} from "@/hooks/reactquery/vendors";
import {
  useAttachments,
  useDeleteAttachment,
  useUploadAttachments,
  type Attachment,
} from "@/hooks/reactquery/attachments";
import { useAppToast } from "@/hooks/common/useAppToast";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/common";
import { useMe } from "@/hooks/reactquery/auth";
import { vendorSchema } from "@/components/forms/schema/vendor";
import type { Vendor } from "@/hooks/reactquery/vendors";

type VendorFormOutput = z.output<typeof vendorSchema>;


// Inner component that loads attachments only when editing an existing vendor
function AttachmentLoader({
  vendorId,
  children,
}: {
  vendorId: number;
  children: (data: {
    attachments: Attachment[];
    onDelete: (att: Attachment) => Promise<void>;
  }) => React.ReactNode;
}) {
  const { data: attachments = [] } = useAttachments("vendor", vendorId);
  const deleteAtt = useDeleteAttachment();
  const appToast = useAppToast();

  const onDelete = async (att: Attachment) => {
    try {
      await deleteAtt.mutateAsync({ id: att.id, path: att.fileUrl });
    } catch (e) {
      appToast.error(e, "계약서 사진을 삭제하지 못했습니다.");
    }
  };

  return <>{children({ attachments, onDelete })}</>;
}

export function VendorManagementSection() {
  const appToast = useAppToast();
  const { data: me } = useMe();
  const orgId = me?.orgId;

  const categoriesQuery = useVendorCategories();
  const { data: categories = [] } = categoriesQuery;
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  // All vendors (no filter) for sidebar counts
  const allVendorsQuery = useVendors();
  const { data: allVendors = [] } = allVendorsQuery;
  // Filtered vendors for the list
  const vendorsQuery = useVendors(
    selectedCategoryId ?? undefined,
    debouncedSearch || undefined
  );
  const { data: vendors = [] } = vendorsQuery;

  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const uploadVendorAttachments = useUploadAttachments();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [createdVendorIdForRetry, setCreatedVendorIdForRetry] = useState<number | null>(null);
  const selectedCategoryLabel = selectedCategoryId === null
    ? "전체"
    : (categories.find((category) => category.id === selectedCategoryId)?.label ?? "미분류");
  const isVendorListLoading = categoriesQuery.isLoading || vendorsQuery.isLoading;
  const isVendorListError = categoriesQuery.isError || vendorsQuery.isError;
  const isVendorListRefreshing = [categoriesQuery, vendorsQuery]
    .some((query) => query.isFetching && !query.isLoading);
  const isVendorSavePending =
    createVendor.isPending || updateVendor.isPending || uploadVendorAttachments.isPending;

  const openCreate = () => {
    setEditingVendor(null);
    setCreatedVendorIdForRetry(null);
    setModalOpen(true);
  };

  const openEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingVendor(null);
    setCreatedVendorIdForRetry(null);
  };

  const handleDeleteVendor = async (id: number) => {
    try {
      await deleteVendor.mutateAsync(id);
    } catch (e) {
      appToast.error(e, "업체를 삭제하지 못했습니다.");
    }
  };

  const handleSubmit = async (values: VendorFormOutput, pendingFiles: File[]) => {
    if (!orgId) {
      appToast.error("인증 정보가 없습니다.");
      throw new Error("인증 정보가 없습니다.");
    }
    try {
      let vendorId = editingVendor?.id ?? createdVendorIdForRetry;
      if (vendorId) {
        await updateVendor.mutateAsync({ id: vendorId, input: { ...values, orgId } });
      } else {
        const createdVendor = await createVendor.mutateAsync({ ...values, orgId });
        vendorId = createdVendor.id;
        setCreatedVendorIdForRetry(createdVendor.id);
      }

      if (pendingFiles.length === 0) return { failedFiles: [] };
      const uploadResult = await uploadVendorAttachments.mutateAsync({
        entityType: "vendor",
        entityId: vendorId,
        orgId,
        kind: "contract",
        fileType: "image",
        files: pendingFiles,
      });
      const failedFiles = uploadResult.failed.map(({ file }) => file);
      if (failedFiles.length > 0) {
        appToast.warning(
          `업체는 저장됐지만 사진 ${failedFiles.length}장을 올리지 못했습니다. 실패한 사진만 다시 시도해 주세요.`,
        );
      }
      return { failedFiles };
    } catch (e) {
      appToast.error(e, "업체를 저장하지 못했습니다.");
      throw e;
    }
  };

  return (
    <div className={vendorClasses.workspace}>
      <VendorCategorySidebar
        categories={categories}
        allVendors={allVendors}
        selectedId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
      />

      {/* Right content */}
      <section className={vendorClasses.panel} aria-label="협력업체 목록">
        <div className={vendorClasses.panelHeader}>
          <h2 className={vendorClasses.panelTitle}>{selectedCategoryLabel}</h2>
          <span className={vendorClasses.countBadge}>{vendors.length}곳</span>
          {isVendorListRefreshing ? (
            <span role="status" aria-label="협력업체 목록 갱신 중" className="text-xs text-t3">
              갱신 중…
            </span>
          ) : null}
          <span className={vendorClasses.panelSpacer} />
          <Input
            unstyled
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="업체명·담당자·연락처 검색"
            aria-label="협력업체 검색"
            className={vendorClasses.search}
          />
          <button type="button" className={vendorClasses.addButton} onClick={openCreate}>
            <PlusIcon className="size-[16px]" aria-hidden="true" />
            업체 추가
          </button>
        </div>

        <VendorList
          vendors={vendors}
          categories={categories}
          isLoading={isVendorListLoading}
          isError={isVendorListError}
          onRetry={() => {
            void categoriesQuery.refetch();
            void vendorsQuery.refetch();
          }}
          onRowClick={openEdit}
        />
      </section>

      {/* Modal */}
      {editingVendor ? (
        <AttachmentLoader vendorId={editingVendor.id}>
          {({ attachments, onDelete }) => (
            <VendorFormModal
              open={modalOpen}
              onClose={closeModal}
              editing={editingVendor}
              categories={categories}
              onSubmit={handleSubmit}
              isPending={isVendorSavePending}
              onDeleteVendor={handleDeleteVendor}
              attachments={attachments}
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
          isPending={isVendorSavePending}
        />
      )}
    </div>
  );
}
