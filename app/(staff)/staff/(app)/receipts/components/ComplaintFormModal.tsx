"use client";

import type { Account } from "@/hooks/reactquery/accounts";
import type { AsCategory } from "@/hooks/reactquery/asCategories";
import type { Building } from "@/hooks/reactquery/buildings";
import type { ComplaintInput } from "@/hooks/reactquery/complaints";
import {
  AsComplaintForm,
  type ComplaintCreateDefaults,
  type ResolutionDraft,
} from "./AsComplaintForm";

interface ComplaintFormModalProps {
  open: boolean;
  createDefaults: ComplaintCreateDefaults;
  receiverName: string;
  orgId?: number;
  buildings: Building[];
  categories: AsCategory[];
  assignees: Account[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: ComplaintInput, resolution: ResolutionDraft | null) => Promise<void>;
}

/** A/S 접수 추가(Figma) — 단일 플랫 폼 래퍼. */
export function ComplaintFormModal({
  open,
  createDefaults,
  receiverName,
  orgId,
  buildings,
  categories,
  assignees,
  isPending,
  onClose,
  onSubmit,
}: ComplaintFormModalProps) {
  return (
    <AsComplaintForm
      open={open}
      mode="create"
      editing={null}
      createDefaults={createDefaults}
      receiverName={receiverName}
      orgId={orgId}
      buildings={buildings}
      categories={categories}
      assignees={assignees}
      isPending={isPending}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
