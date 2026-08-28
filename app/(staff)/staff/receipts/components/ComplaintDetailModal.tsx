"use client";

import type { Account } from "@/hooks/reactquery/accounts";
import type { AsCategory } from "@/hooks/reactquery/asCategories";
import type { Building } from "@/hooks/reactquery/buildings";
import type { Complaint, ComplaintInput } from "@/hooks/reactquery/complaints";
import { AsComplaintForm, type ResolutionDraft } from "./AsComplaintForm";

interface ComplaintDetailModalProps {
  open: boolean;
  complaint: Complaint | null;
  orgId?: number;
  buildings: Building[];
  categories: AsCategory[];
  assignees: Account[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: ComplaintInput, resolution: ResolutionDraft | null) => Promise<void>;
  onDelete: (complaint: Complaint) => void | Promise<void>;
  onSendMessage: (complaint: Complaint) => void;
}

/** A/S 접수 상세(Figma) — 추가와 동일 폼 + 삭제/확인문자/저장 래퍼. */
export function ComplaintDetailModal({
  open,
  complaint,
  orgId,
  buildings,
  categories,
  assignees,
  isPending,
  onClose,
  onSubmit,
  onDelete,
  onSendMessage,
}: ComplaintDetailModalProps) {
  if (!complaint) return null;
  return (
    <AsComplaintForm
      open={open}
      mode="detail"
      editing={complaint}
      orgId={orgId}
      buildings={buildings}
      categories={categories}
      assignees={assignees}
      isPending={isPending}
      onClose={onClose}
      onSubmit={onSubmit}
      onDelete={onDelete}
      onSendMessage={onSendMessage}
    />
  );
}
