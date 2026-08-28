"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Input, Select, Spinner } from "@/components/common";
import type { Account } from "@/hooks/reactquery/accounts";
import {
  useComplaintResolutions,
  type Complaint,
  type ComplaintResolution,
  type ComplaintResolutionInput,
  type ComplaintStatus,
} from "@/hooks/reactquery/complaints";
import {
  COMPLAINT_STATUS_LABEL,
  COMPLAINT_STATUS_OPTIONS,
  COMPLAINT_STATUS_STYLE,
  formatComplaintDate,
  formatUnitLabel,
} from "../constants";
import { ComplaintDialog } from "./ComplaintDialog";

function toLocalDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ComplaintDetailModal({
  open,
  complaint,
  assignees,
  isComplaintPending,
  isResolutionPending,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onCreateResolution,
  onUpdateResolution,
  onDeleteResolution,
  onMessageAssignee,
  onMessageResident,
  residentMessageTitle,
}: {
  open: boolean;
  complaint: Complaint | null;
  assignees: Account[];
  isComplaintPending: boolean;
  isResolutionPending: boolean;
  onClose: () => void;
  onEdit: (complaint: Complaint) => void;
  onDelete: (complaint: Complaint) => Promise<void>;
  onStatusChange: (complaint: Complaint, status: ComplaintStatus) => Promise<void>;
  onCreateResolution: (input: ComplaintResolutionInput) => Promise<void>;
  onUpdateResolution: (
    resolution: ComplaintResolution,
    input: Partial<ComplaintResolutionInput>,
  ) => Promise<void>;
  onDeleteResolution: (resolution: ComplaintResolution) => Promise<void>;
  onMessageAssignee: (complaint: Complaint) => void;
  onMessageResident: (complaint: Complaint) => void;
  residentMessageTitle?: string;
}) {
  const complaintId = complaint?.id ?? 0;
  const { data: loadedResolutions, isLoading: resolutionsLoading } =
    useComplaintResolutions(complaintId);
  const resolutions = loadedResolutions ?? complaint?.resolutions ?? [];
  const assignee = useMemo(
    () => assignees.find((account) => account.userId === complaint?.assignedTo),
    [assignees, complaint?.assignedTo],
  );

  const [resolutionFormOpen, setResolutionFormOpen] = useState(false);
  const [editingResolution, setEditingResolution] = useState<ComplaintResolution | null>(null);
  const [resultContent, setResultContent] = useState("");
  const [resultNotes, setResultNotes] = useState("");
  const [resolvedAt, setResolvedAt] = useState(toLocalDateTime());
  const [resolutionError, setResolutionError] = useState("");
  const [confirmDeleteComplaint, setConfirmDeleteComplaint] = useState(false);
  const [confirmDeleteResolutionId, setConfirmDeleteResolutionId] = useState<number | null>(null);

  if (!complaint) return null;

  const startCreateResolution = () => {
    setEditingResolution(null);
    setResultContent("");
    setResultNotes("");
    setResolvedAt(toLocalDateTime());
    setResolutionError("");
    setResolutionFormOpen(true);
  };

  const startEditResolution = (resolution: ComplaintResolution) => {
    setEditingResolution(resolution);
    setResultContent(resolution.resultContent ?? "");
    setResultNotes(resolution.resultNotes ?? "");
    setResolvedAt(toLocalDateTime(resolution.resolvedAt));
    setResolutionError("");
    setResolutionFormOpen(true);
  };

  const saveResolution = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resultContent.trim()) {
      setResolutionError("처리 결과를 입력해 주세요.");
      return;
    }
    const input = {
      complaintId: complaint.id,
      resultContent: resultContent.trim(),
      resultNotes: resultNotes.trim() || null,
      resolvedAt: resolvedAt ? new Date(resolvedAt).toISOString() : null,
    };
    if (editingResolution) await onUpdateResolution(editingResolution, input);
    else await onCreateResolution(input);
    setResolutionFormOpen(false);
    setEditingResolution(null);
  };

  return (
    <ComplaintDialog open={open} onClose={onClose} title="민원·AS 상세">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`px-2.5 py-1 ${COMPLAINT_STATUS_STYLE[complaint.status]}`}>
                {COMPLAINT_STATUS_LABEL[complaint.status]}
              </Badge>
              <span className="text-xs text-t3">접수 #{complaint.id}</span>
            </div>
            <h3 className="mt-3 text-xl font-extrabold text-t1">{complaint.title}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => onEdit(complaint)}>
              접수 정보 수정
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!complaint.assignedTo}
              onClick={() => onMessageAssignee(complaint)}
            >
              담당 기사 문자 전송
            </Button>
            <Button
              type="button"
              variant="ghost"
              title={residentMessageTitle}
              onClick={() => onMessageResident(complaint)}
            >
              입주자 안내
            </Button>
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["건물", complaint.buildingName ?? "-"],
            ["호실", formatUnitLabel({ unitNo: complaint.unitNo, dong: complaint.unitDong })],
            ["AS 구분", complaint.categoryLabel ?? "-"],
            ["접수일시", formatComplaintDate(complaint.receivedAt, true)],
            ["신고자", complaint.reporterName ?? "-"],
            ["연락처", complaint.reporterPhone ?? "-"],
            ["담당 기사", assignee?.fullName ?? (complaint.assignedTo ? "배정됨" : "미배정")],
            ["완료일시", formatComplaintDate(complaint.completedAt, true)],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface p-4">
              <p className="text-xs font-bold text-t3">{label}</p>
              <p className="mt-1.5 text-sm font-semibold text-t1">{value}</p>
            </div>
          ))}
        </div>

        <section>
          <h4 className="text-sm font-extrabold text-t1">접수내용</h4>
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-bg p-4 text-sm leading-6 text-t2">
            {complaint.content || "내용 없음"}
          </p>
        </section>

        <section className="rounded-2xl border border-line p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="w-full max-w-xs space-y-2 text-sm font-bold text-t2">
              처리 상태
              <Select
                aria-label="처리 상태"
                value={complaint.status}
                disabled={isComplaintPending}
                onChange={(event) =>
                  void onStatusChange(complaint, event.target.value as ComplaintStatus)
                }
                options={COMPLAINT_STATUS_OPTIONS}
              />
            </label>
            {confirmDeleteComplaint ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-red">접수와 처리이력을 삭제할까요?</span>
                <Button
                  type="button"
                  variant="danger"
                  disabled={isComplaintPending}
                  onClick={() => void onDelete(complaint)}
                >
                  삭제 확인
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmDeleteComplaint(false)}>
                  취소
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setConfirmDeleteComplaint(true)}>
                접수 삭제
              </Button>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-base font-extrabold text-t1">처리이력</h4>
              <p className="mt-1 text-xs text-t3">현장 처리 결과와 특이사항을 시간순으로 관리합니다.</p>
            </div>
            <Button type="button" onClick={startCreateResolution}>+ 처리이력 추가</Button>
          </div>

          {resolutionFormOpen && (
            <form className="mb-4 space-y-4 rounded-2xl bg-blue-t2 p-4" onSubmit={saveResolution}>
              <h5 className="text-sm font-extrabold text-t1">
                {editingResolution ? "처리이력 수정" : "새 처리이력"}
              </h5>
              <label className="block space-y-2 text-sm font-bold text-t2">
                처리 결과 <span className="text-red">*</span>
                <textarea
                  aria-label="처리 결과"
                  value={resultContent}
                  onChange={(event) => setResultContent(event.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-sm focus:border-brand focus:outline-none"
                  placeholder="조치한 내용을 입력해 주세요."
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-bold text-t2">
                  처리일시
                  <Input
                    aria-label="처리일시"
                    type="datetime-local"
                    value={resolvedAt}
                    onChange={(event) => setResolvedAt(event.target.value)}
                  />
                </label>
                <label className="space-y-2 text-sm font-bold text-t2">
                  특이사항
                  <Input
                    aria-label="특이사항"
                    value={resultNotes}
                    onChange={(event) => setResultNotes(event.target.value)}
                    placeholder="재방문, 부품 교체 등"
                  />
                </label>
              </div>
              {resolutionError && <p role="alert" className="text-sm font-semibold text-red">{resolutionError}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setResolutionFormOpen(false)}
                >
                  취소
                </Button>
                <Button type="submit" disabled={isResolutionPending}>
                  {isResolutionPending ? "저장 중…" : "처리이력 저장"}
                </Button>
              </div>
            </form>
          )}

          {resolutionsLoading ? (
            <Spinner />
          ) : resolutions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-t4">
              아직 등록된 처리이력이 없습니다.
            </div>
          ) : (
            <ol className="space-y-3">
              {resolutions.map((resolution) => (
                <li key={resolution.id} className="rounded-xl border border-line p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-t1">
                        {resolution.resultContent || "처리 결과 없음"}
                      </p>
                      {resolution.resultNotes && (
                        <p className="mt-2 text-xs leading-5 text-t3">특이사항 · {resolution.resultNotes}</p>
                      )}
                      <p className="mt-2 text-xs text-t4">
                        {formatComplaintDate(resolution.resolvedAt ?? resolution.createdAt, true)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 text-xs font-bold text-blue hover:bg-blue-t"
                        onClick={() => startEditResolution(resolution)}
                      >
                        수정
                      </button>
                      {confirmDeleteResolutionId === resolution.id ? (
                        <>
                          <button
                            type="button"
                            className="rounded-lg px-2 py-1 text-xs font-bold text-red hover:bg-red-t"
                            disabled={isResolutionPending}
                            onClick={() => void onDeleteResolution(resolution)}
                          >
                            삭제 확인
                          </button>
                          <button
                            type="button"
                            className="rounded-lg px-2 py-1 text-xs font-bold text-t3 hover:bg-bg"
                            onClick={() => setConfirmDeleteResolutionId(null)}
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-xs font-bold text-t3 hover:bg-bg"
                          onClick={() => setConfirmDeleteResolutionId(resolution.id)}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </ComplaintDialog>
  );
}
