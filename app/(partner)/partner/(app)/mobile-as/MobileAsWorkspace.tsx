"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  useDeletePartnerComplaint,
  usePartnerComplaintEditor,
  useUpdatePartnerComplaint,
  type PartnerAsCategory,
  type PartnerComplaintDetail,
} from "@/hooks/reactquery/complaints";

import { PartnerBottomActionBar } from "../../../_components/PartnerBottomActionBar";
import { PartnerConfirmDialog } from "../../../_components/PartnerConfirmDialog";
import { PartnerFormFieldRow } from "../../../_components/PartnerFormFieldRow";
import { PartnerInlineError } from "../../../_components/PartnerInlineError";
import { PartnerMobileHeader } from "../../../_components/PartnerMobileHeader";
import { AS_STATUS, combineDateTime, fmtDateTime, splitDateTime } from "../_as";
import { asFormClasses as styles } from "../asFormClasses";

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

  const [categoryId, setCategoryId] = useState(
    d.category_id !== null ? String(d.category_id) : "",
  );
  const [content, setContent] = useState(d.content ?? "");
  const [status, setStatus] = useState(d.status ?? "pending");
  const [date, setDate] = useState(completedAt.date);
  const [time, setTime] = useState(completedAt.time);
  const [result, setResult] = useState(d.result_content ?? "");

  const [err, setErr] = useState("");
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const isComplaintMutating = updateMutation.isPending || deleteMutation.isPending;

  const save = async () => {
    if (isComplaintMutating) return;
    setErr("");
    if (!content.trim()) {
      setErr("접수 내용을 입력해 주세요");
      return;
    }
    if (!date) {
      setErr("시행일자를 선택해 주세요");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: complaintId,
        categoryId: categoryId ? Number(categoryId) : null,
        content: content.trim(),
        status,
        completedAt: combineDateTime(date, time),
        resultContent: result.trim(),
      });
      router.push("/partner/mobile-home");
    } catch {
      setErr("저장에 실패했어요. 다시 시도해 주세요.");
    }
  };

  const del = async () => {
    if (isComplaintMutating) return;
    try {
      await deleteMutation.mutateAsync(complaintId);
      router.push("/partner/mobile-home");
    } catch {
      setErr("삭제에 실패했어요.");
      setConfirmDel(false);
    }
  };

  const header = <PartnerMobileHeader title="A/S 상세" backHref="/partner/mobile-home" variant="compact" />;

  const ro = !d.is_mine;

  return (
    <div className={styles.root}>
      {header}
      <div className={styles.scroll}>
        <div className={styles.sec}>
          <div className={styles.secTitle}>대상 세대</div>
          <div className={styles.box}>
            <PartnerFormFieldRow label="건물">
              <span className={styles.ro}>{d.building_name}</span>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="호수">
              <span className={styles.ro}>{d.unit_label ?? "건물 전체"}</span>
            </PartnerFormFieldRow>
          </div>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>A/S 내용</div>
          <div className={styles.box}>
            <PartnerFormFieldRow label="접수자">
              <span className={styles.ro}>{d.logger_name ?? "-"}</span>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="담당자">
              <span className={styles.ro}>{d.assigned_name ?? "-"}</span>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="접수일시">
              <span className={styles.ro}>{fmtDateTime(d.received_at)}</span>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="유형">
              <select className={styles.control} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={ro}>
                <option value="">선택 안 함</option>
                {cats.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.label}</option>
                ))}
              </select>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="입주자 전화번호">
              <span className={styles.ro}>{d.reporter_phone ?? "-"}</span>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="접수 내용" column>
              <textarea className={styles.textarea} value={content} onChange={(e) => setContent(e.target.value)} placeholder="접수 내용을 입력해 주세요" disabled={ro} />
            </PartnerFormFieldRow>
          </div>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>처리</div>
          <div className={styles.box}>
            <PartnerFormFieldRow label="처리결과">
              <select className={styles.control} value={status} onChange={(e) => setStatus(e.target.value)} disabled={ro}>
                {AS_STATUS.map((s) => (
                  <option key={s.db} value={s.db}>{s.ko}</option>
                ))}
              </select>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label={<>시행일자{!ro && <b className={styles.req}>*</b>}</>}>
              <input type="date" className={styles.control} value={date} onChange={(e) => setDate(e.target.value)} disabled={ro} />
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="시간">
              <input type="time" className={styles.control} value={time} onChange={(e) => setTime(e.target.value)} disabled={ro} />
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="처리결과 내용" column>
              <textarea className={styles.textarea} value={result} onChange={(e) => setResult(e.target.value)} placeholder="처리한 내용을 입력해 주세요" disabled={ro} />
            </PartnerFormFieldRow>
          </div>
        </div>

        {err && <PartnerInlineError message={err} />}
      </div>

      {ro ? (
        <PartnerBottomActionBar>
          <div className={styles.note}>담당 건이 아니라 수정할 수 없어요</div>
        </PartnerBottomActionBar>
      ) : (
        <PartnerBottomActionBar>
          <button type="button" className={`${styles.btn} ${styles.btnDel}`} onClick={() => setConfirmDel(true)} disabled={isComplaintMutating}>{deleteMutation.isPending ? "삭제 중…" : "삭제"}</button>
          <button type="button" className={`${styles.btn} ${styles.btnPri}`} onClick={() => setConfirmSave(true)} disabled={isComplaintMutating}>{updateMutation.isPending ? "저장 중…" : "저장"}</button>
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
          onConfirm={() => void del()}
          confirmDisabled={isComplaintMutating}
        />
      )}
    </div>
  );
}
