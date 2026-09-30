"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  useDeletePartnerComplaint,
  usePartnerComplaintEditor,
  useUpdatePartnerComplaint,
  type PartnerAsCategory,
  type PartnerComplaintDetail,
} from "@/hooks/reactquery/complaints";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { MaskedPhone } from "@/components/common/MaskedPhone";
import { applyMask, NUMERIC_INPUT_ATTRS } from "@/components/common";
import { CalendarIcon } from "@/components/icons";

import { PartnerBottomActionBar } from "../../../_components/PartnerBottomActionBar";
import { PartnerConfirmDialog } from "../../../_components/PartnerConfirmDialog";
import { PartnerFormFieldRow } from "../../../_components/PartnerFormFieldRow";
import { PartnerMobileHeader } from "../../../_components/PartnerMobileHeader";
import { PartnerToast, usePartnerToast } from "../../../_components/PartnerToast";
import { AS_STATUS, combineDateTime, fmtDate, normalizeTime, splitDateTime, statusKo, timeMask } from "../_as";
import { asFormClasses as styles } from "../asFormClasses";
import { PartnerButton } from "../../../_components/PartnerButton";

/** 정본은 저장·삭제 토스트를 보여 준 뒤 0.7초 있다가 홈으로 간다. */
const LEAVE_DELAY_MS = 700;

export function MobileAsWorkspace({ complaintId }: { complaintId: number | null }) {
  const complaintQuery = usePartnerComplaintEditor(complaintId);
  const header = <PartnerMobileHeader title="A/S 상세" backHref="/partner/mobile-home" variant="compact" />;

  if (complaintId !== null && complaintQuery.isPending) {
    return (
      <div className={styles.root}>
        {header}
        <div className={styles.none} role="status" aria-label="A/S 상세 불러오는 중">불러오는 중…</div>
      </div>
    );
  }

  if (!complaintQuery.data?.detail) {
    return (
      <div className={styles.root}>
        {header}
        <div className={styles.none}>접수 내역을 찾을 수 없어요</div>
      </div>
    );
  }

  return (
    <MobileAsEditor
      key={complaintQuery.data.detail.id}
      complaintId={complaintQuery.data.detail.id}
      detail={complaintQuery.data.detail}
      categories={complaintQuery.data.categories}
    />
  );
}

function MobileAsEditor({
  complaintId,
  detail: d,
  categories: cats,
}: {
  complaintId: number;
  detail: PartnerComplaintDetail;
  categories: PartnerAsCategory[];
}) {
  const router = useRouter();
  const completedAt = splitDateTime(d.completed_at);
  const updateMutation = useUpdatePartnerComplaint();
  const deleteMutation = useDeletePartnerComplaint();
  const { toastMessage, showToast } = usePartnerToast();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [categoryId, setCategoryId] = useState(
    d.category_id !== null ? String(d.category_id) : "",
  );
  const [content, setContent] = useState(d.content ?? "");
  const [status, setStatus] = useState(d.status ?? "pending");
  const [date, setDate] = useState(completedAt.date);
  const [time, setTime] = useState(completedAt.time);
  const [result, setResult] = useState(d.result_content ?? "");

  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  // 저장·삭제 뒤 홈으로 가기 전 0.7초 동안 버튼을 다시 누르지 못하게 한다.
  const [leaving, setLeaving] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isComplaintMutating = updateMutation.isPending || deleteMutation.isPending || leaving;

  useEffect(() => () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
  }, []);

  const leaveWith = (message: string) => {
    setLeaving(true);
    showToast(message);
    leaveTimerRef.current = setTimeout(() => router.push("/partner/mobile-home"), LEAVE_DELAY_MS);
  };

  // 정본 `#adSave`: 입력을 먼저 확인하고, 통과하면 저장 확인창을 연다.
  const requestSave = () => {
    if (isComplaintMutating) return;
    if (!content.trim()) {
      showToast("접수 내용을 입력해 주세요");
      contentRef.current?.focus();
      return;
    }
    if (!date) {
      showToast("시행일자를 선택해 주세요");
      return;
    }
    setConfirmSave(true);
  };

  const save = async () => {
    if (isComplaintMutating) return;
    try {
      await updateMutation.mutateAsync({
        id: complaintId,
        categoryId: categoryId ? Number(categoryId) : null,
        content: content.trim(),
        status,
        completedAt: combineDateTime(date, time),
        resultContent: result.trim(),
      });
      leaveWith("저장했어요");
    } catch {
      showToast("저장에 실패했어요. 다시 시도해 주세요.");
    }
  };

  const del = async () => {
    if (isComplaintMutating) return;
    try {
      await deleteMutation.mutateAsync(complaintId);
      leaveWith("접수를 삭제했어요");
    } catch {
      showToast("삭제에 실패했어요.");
    }
  };

  const header = <PartnerMobileHeader title="A/S 상세" backHref="/partner/mobile-home" variant="compact" />;

  // 정본: 담당 건이 아니면 셀렉터·날짜·입력칸을 모두 글자로 바꾼다.
  const ro = !d.is_mine;
  const categoryLabel = cats.find((c) => String(c.id) === categoryId)?.label;

  return (
    <div className={styles.root}>
      {header}
      <div className={styles.scroll}>
        <div className={styles.sec}>
          <div className={styles.secTitle}>대상 세대</div>
          <PartnerFormFieldRow label="건물">
            <span className={styles.ro}>{d.building_name}</span>
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="호수">
            <span className={styles.ro}>{d.unit_label ?? "건물 전체"}</span>
          </PartnerFormFieldRow>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>A/S 내용</div>
          <PartnerFormFieldRow label="접수자">
            <span className={styles.ro}>{d.logger_name ?? "-"}</span>
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="담당자">
            <span className={styles.ro}>{d.assigned_name ?? "-"}</span>
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="접수일시">
            <span className={`${styles.ro} tabular-nums`}>{fmtDate(d.received_at)}</span>
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="유형">
            {ro ? (
              <span className={styles.ro}>{categoryLabel ?? "-"}</span>
            ) : (
              <select className={styles.control} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="유형">
                {categoryId === "" && <option value="">유형 선택</option>}
                {cats.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.label}</option>
                ))}
              </select>
            )}
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="입주자 전화번호">
            <span className={`${styles.ro} tabular-nums`}>
              {d.reporter_phone ? (
                <MaskedPhone
                  value={d.reporter_phone}
                  kind="phone"
                  compact
                  reveal={{ targetKind: "complaint", targetId: d.id, field: "reporter_phone" }}
                />
              ) : (
                "-"
              )}
            </span>
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="접수 내용" column>
            {ro ? (
              <div className={styles.roText}>{content || "—"}</div>
            ) : (
              <textarea ref={contentRef} className={styles.textarea} value={content} onChange={(e) => setContent(e.target.value)} placeholder="접수 내용을 입력해 주세요" />
            )}
          </PartnerFormFieldRow>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>처리</div>
          <PartnerFormFieldRow label="처리결과">
            {ro ? (
              <span className={styles.ro}>{statusKo(status)}</span>
            ) : (
              <select className={styles.control} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="처리결과">
                {AS_STATUS.map((s) => (
                  <option key={s.db} value={s.db}>{s.ko}</option>
                ))}
              </select>
            )}
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label={<>시행일자<b className={styles.req}>*</b></>}>
            {ro ? (
              <span className={styles.ro}>{date ? date.replaceAll("-", ".") : "-"}</span>
            ) : (
              <DpDatePicker
                value={date}
                onChange={setDate}
                ariaLabel="시행일자"
                placeholder="날짜 선택"
                className={styles.pickerRoot}
                triggerClassName={styles.picker}
                triggerOpenClassName={styles.pickerOpen}
                endAdornment={<CalendarIcon className="ml-auto size-4 shrink-0 text-t3" aria-hidden="true" />}
              />
            )}
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="시간">
            {ro ? (
              <span className={styles.ro}>{time || "—"}</span>
            ) : (
              <input
                className={styles.time}
                {...NUMERIC_INPUT_ATTRS}
                placeholder="00:00"
                maxLength={5}
                aria-label="시간"
                value={time}
                onChange={(e) => setTime(applyMask(e.currentTarget, timeMask))}
                onBlur={() => setTime(normalizeTime(time))}
              />
            )}
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="처리결과 내용" column>
            {ro ? (
              <div className={styles.roText}>{result || "—"}</div>
            ) : (
              <textarea className={styles.textarea} value={result} onChange={(e) => setResult(e.target.value)} placeholder="처리한 내용을 입력해 주세요" />
            )}
          </PartnerFormFieldRow>
        </div>
      </div>

      {ro ? (
        <PartnerBottomActionBar>
          <div className={styles.note}>담당 건이 아니라 수정할 수 없어요</div>
        </PartnerBottomActionBar>
      ) : (
        <PartnerBottomActionBar>
          <PartnerButton variant="dangerTint" type="button" className="flex-[0_0_108px]" onClick={() => setConfirmDel(true)} disabled={isComplaintMutating}>삭제</PartnerButton>
          <PartnerButton variant="primary" type="button" className="flex-1" onClick={requestSave} disabled={isComplaintMutating}>저장</PartnerButton>
        </PartnerBottomActionBar>
      )}

      {confirmSave && (
        <PartnerConfirmDialog
          title="저장할까요?"
          description="변경한 내용이 저장돼요."
          cancelLabel="취소"
          confirmLabel="저장"
          onCancel={() => setConfirmSave(false)}
          onConfirm={() => { setConfirmSave(false); void save(); }}
          confirmDisabled={isComplaintMutating}
        />
      )}

      {confirmDel && (
        <PartnerConfirmDialog
          title="접수를 삭제할까요?"
          description="삭제하면 되돌릴 수 없어요."
          cancelLabel="취소"
          confirmLabel="삭제"
          confirmVariant="danger"
          onCancel={() => setConfirmDel(false)}
          onConfirm={() => { setConfirmDel(false); void del(); }}
          confirmDisabled={isComplaintMutating}
        />
      )}

      <PartnerToast message={toastMessage} />
    </div>
  );
}
