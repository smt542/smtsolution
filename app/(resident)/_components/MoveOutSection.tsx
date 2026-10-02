"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import ResidentBottomSheet from "@/app/(resident)/_components/ResidentBottomSheet";
import ResidentConfirmDialog from "@/app/(resident)/_components/ResidentConfirmDialog";
import { showResidentToast } from "@/app/(resident)/_components/residentToast";
import { DpCalendar, type DpCalendarView } from "@/components/common/DpCalendar";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  moveOutDateSchema,
  type MoveOutDateInput,
  type MoveOutDateValues,
} from "@/components/forms/schema/residentMoveOut";
import {
  useCancelMoveOut,
  useCreateMoveOut,
  useMoveOutRequest,
  useUpdateMoveOut,
  type ResidentMoveOutRequest,
} from "@/hooks/reactquery/residentMoveOut";
import { formatDate } from "@/lib/format";

import { moveOutClasses as styles } from "./moveOutClasses";
import { ResidentButton } from "@/app/(resident)/_components/ResidentButton";

type MoveOutSectionProps = {
  open: boolean;
  onClose: () => void;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthOf = (key: string): DpCalendarView => {
  const [y, m] = key.split("-").map(Number);
  return { y, m: m - 1 };
};
const withWeekday = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return `${formatDate(key)}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
};

// 고를 수 있는 날짜 = 내일부터 6개월 뒤 달의 말일까지(원본 달력 MIN·MAX)
function selectableRange() {
  const now = new Date();
  return {
    min: dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)),
    max: dateKey(new Date(now.getFullYear(), now.getMonth() + 7, 0)),
  };
}

// 확정(처리 완료)된 신청도 원본처럼 '확인 중' 현황으로 보여 주고 변경·취소를 받는다(0211). 취소·반려는 새 신청.
const isActive = (request: ResidentMoveOutRequest | null | undefined): request is ResidentMoveOutRequest =>
  request?.status === "pending" || request?.status === "confirmed";

type DateFormProps = {
  /** 희망 퇴실일 변경이면 지금 신청된 날짜, 새 신청이면 null */
  current: string | null;
  submitting: boolean;
  onSubmit: (desiredDate: string) => Promise<void>;
};

function MoveOutDateForm({ current, submitting, onSubmit }: DateFormProps) {
  const [range] = useState(selectableRange);
  const [view, setView] = useState(() => monthOf(current ?? range.min));
  const form = useForm<MoveOutDateInput, unknown, MoveOutDateValues>({
    resolver: zodResolver(moveOutDateSchema),
    defaultValues: { desiredDate: current ?? "" },
  });
  const picked = useWatch({ control: form.control, name: "desiredDate" });
  const pickable = Boolean(picked) && picked >= range.min && picked <= range.max;
  const busy = submitting || form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values.desiredDate);
    } catch (error) {
      setSubmissionError(
        error,
        form.setError,
        current ? "희망 퇴실일을 변경하지 못했어요." : "퇴실 신청을 접수하지 못했어요.",
      );
    }
  });

  return (
    <form onSubmit={submit} noValidate className={styles.sheet}>
      <div className={styles.formHead}>
        <div className={styles.title}>{current ? "희망 퇴실일 변경" : "퇴실 신청"}</div>
        <p className={styles.desc}>
          {current ? (
            <>현재 <b>{formatDate(current)}</b>로 신청되어 있어요. 새로 희망하는 날짜를 선택해 주세요.</>
          ) : (
            <>희망하는 퇴실일을 선택해 주세요. 신청하면 <b>담당자가 확인 후 연락</b>드려요.</>
          )}
        </p>
      </div>
      <div className={styles.formBody}>
        <div className={styles.fieldLabel}>희망 퇴실일</div>
        <Controller
          name="desiredDate"
          control={form.control}
          render={({ field }) => (
            <DpCalendar
              look="sheet"
              view={view}
              onViewChange={setView}
              value={field.value ?? ""}
              onPick={field.onChange}
              minDate={range.min}
              maxDate={range.max}
            />
          )}
        />
        <p className={styles.hint}>최종 검침을 위해 3일 이상 여유를 두고 신청해 주세요. 일정은 통화 중 조정할 수 있어요.</p>
        {current ? null : (
          <div className={styles.note}>
            <b>신청 후 진행 순서</b>
            <ul>
              <li>담당자가 확인 후 1영업일 안에 전화로 연락드려요.</li>
              <li>확정된 퇴실일에 최종 검침을 하고 관리비를 확정해요.</li>
              <li>미납·연체료를 차감한 정산 결과를 안내해 드려요.</li>
            </ul>
          </div>
        )}
      </div>
      <div className={styles.foot}>
        {form.formState.errors.root?.server?.message ? (
          <p className={styles.error} role="alert">{form.formState.errors.root.server.message}</p>
        ) : null}
        <ResidentButton
          variant="primary"
          size="moveOut"
          type="submit"
          className={styles.submit}
          disabled={!pickable || busy}
        >
          {current ? "변경 저장하기" : "퇴실 신청하기"}
        </ResidentButton>
      </div>
    </form>
  );
}

export default function MoveOutSection({ open, onClose }: MoveOutSectionProps) {
  const requestQuery = useMoveOutRequest();
  const createMutation = useCreateMoveOut();
  const updateMutation = useUpdateMoveOut();
  const cancelMutation = useCancelMoveOut();
  const [editing, setEditing] = useState(false);
  const [createdDate, setCreatedDate] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // 시트를 닫을 때마다 올려 신청 폼(고른 날짜·보이는 달)을 새로 시작한다
  const [session, setSession] = useState(0);

  const busy = createMutation.isPending || updateMutation.isPending || cancelMutation.isPending;
  const request = requestQuery.data;
  const active = isActive(request) ? request : null;

  const reset = () => {
    setEditing(false);
    setCreatedDate(null);
    setCancelOpen(false);
    setCancelError(null);
    setSession((value) => value + 1);
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const create = async (desiredDate: string) => {
    try {
      await createMutation.mutateAsync({ desiredDate });
      setCreatedDate(desiredDate);
    } catch (error) {
      // 다른 곳에서 먼저 신청돼 있으면 오류 대신 현황을 보여 준다
      const refreshed = await requestQuery.refetch();
      if (isActive(refreshed.data)) return;
      throw error;
    }
  };

  const update = async (desiredDate: string) => {
    await updateMutation.mutateAsync(desiredDate);
    reset();
    onClose();
    showResidentToast(`희망 퇴실일을 ${formatDate(desiredDate)}로 변경했어요`, "nav");
  };

  const cancel = async () => {
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync();
    } catch (error) {
      setCancelOpen(false);
      setCancelError(error instanceof Error ? error.message : "퇴실 신청을 취소하지 못했어요.");
      return;
    }
    reset();
    onClose();
    showResidentToast("퇴실 신청을 취소했어요", "nav");
  };

  let content;
  if (createdDate) {
    content = (
      <div className={styles.ok}>
        <div className={styles.okIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4.5 4.5L19 7" />
          </svg>
        </div>
        <h3 className={styles.okTitle}>퇴실 신청이 접수됐어요</h3>
        <p className={styles.okDesc}>담당자가 확인 후 1영업일 안에<br />전화로 연락드려요.</p>
        <div className={`${styles.sum} ${styles.sumFirst}`}>
          <span>희망 퇴실일</span>
          <b>{formatDate(createdDate)}</b>
        </div>
        <ResidentButton variant="primary" size="moveOut" type="button" className={styles.submit} onClick={close}>
          확인
        </ResidentButton>
      </div>
    );
  } else if (requestQuery.isPending) {
    content = (
      <div className={styles.state} role="status">
        퇴실 신청 내역을 확인하고 있어요.
      </div>
    );
  } else if (requestQuery.error) {
    content = (
      <div className={styles.state} role="alert">
        <b>퇴실 신청 내역을 불러오지 못했어요.</b>
        <button type="button" onClick={() => void requestQuery.refetch()}>
          다시 시도
        </button>
      </div>
    );
  } else if (active && !editing) {
    content = (
      <div className={styles.sheet}>
        <div className={styles.viewHead}>
          <div className={styles.title}>퇴실 신청 현황</div>
          <p className={styles.desc}>담당자가 확인 중이에요. 확인 후 <b>전화로 연락</b>드려요.</p>
        </div>
        <div className={styles.viewBody}>
          <div className={styles.sum}>
            <span>희망 퇴실일</span>
            <b>{withWeekday(active.desiredDate)}</b>
          </div>
          <div className={`${styles.sum} ${styles.sumNext}`}>
            <span>신청일</span>
            <b>{formatDate(dateKey(new Date(active.createdAt)))}</b>
          </div>
          <div className={styles.note}>
            <b>안내</b>
            <ul>
              <li>담당자와 통화 전이라면 희망일을 변경할 수 있어요.</li>
              <li>퇴실을 취소하려면 신청 취소를 눌러주세요.</li>
            </ul>
          </div>
        </div>
        <div className={styles.foot}>
          {cancelError ? <p className={styles.error} role="alert">{cancelError}</p> : null}
          <ResidentButton
            variant="primary"
            size="moveOut"
            type="button"
            className={styles.submit}
            onClick={() => {
              setCancelError(null);
              setEditing(true);
            }}
          >
            희망 퇴실일 변경
          </ResidentButton>
          <ResidentButton
            variant="secondary"
            size="moveOut"
            type="button"
            className={styles.ghost}
            onClick={() => {
              setCancelError(null);
              setCancelOpen(true);
            }}
          >
            신청 취소
          </ResidentButton>
        </div>
      </div>
    );
  } else {
    content = (
      <MoveOutDateForm
        key={`${session}-${editing ? "edit" : "new"}`}
        current={editing && active ? active.desiredDate : null}
        submitting={editing ? updateMutation.isPending : createMutation.isPending}
        onSubmit={editing ? update : create}
      />
    );
  }

  return (
    <>
      <ResidentBottomSheet variant="moveOut" open={open} onDismiss={close}>
        {content}
      </ResidentBottomSheet>
      <ResidentConfirmDialog
        open={cancelOpen}
        title="퇴실 신청을 취소할까요?"
        description={<>취소하면 신청 내역이 사라져요.<br />필요하면 다시 신청할 수 있어요.</>}
        confirmLabel="신청 취소"
        tone="danger"
        busy={cancelMutation.isPending}
        cancelDisabled={cancelMutation.isPending}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => void cancel()}
      />
    </>
  );
}
