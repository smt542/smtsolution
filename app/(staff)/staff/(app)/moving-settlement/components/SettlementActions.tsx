"use client";

import type { RefObject } from "react";
import { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import {
  movingSettlementSchema,
  type MovingSettlementValues,
} from "@/components/forms/schema/movingSettlement";
import {
  useCompleteSettlement,
  useDeleteSettlement,
  useMidMoveout,
  useSaveSettlement,
  type SaveSettlementInput,
  type SettlementContext,
} from "@/hooks/reactquery/movingSettlement";
import { formatWon } from "@/lib/format";
import { SettlementActionBar } from "./SettlementActionBar";
import { SettlementDecisionDialog } from "./SettlementDecisionDialog";
import {
  printSettlementStatement,
  type SettlementStatementPrintModel,
} from "./movingSettlementPrint";

type DialogState =
  | "outstanding"
  | "mid-confirm"
  | "moveout-confirm"
  | "delete"
  | null;

const EMPTY_INPUT_REF: RefObject<HTMLInputElement | null> = { current: null };
const EMPTY_BODY_REF: RefObject<HTMLDivElement | null> = { current: null };

function formatCreatedAt(value: string | null): string {
  if (!value) return "작성 중인";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "작성 중인";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}.${part("month")}.${part("day")} ${part("hour")}:${part("minute")} 작성 건`;
}

export function SettlementActions({
  building,
  unit,
  draft,
  input,
  settlementId,
  amount,
  receivedAmount = 0,
  billingUnpaid = 0,
  vacancyPaymentMode = "manual",
  createdAt = null,
  locked = false,
  completedLocked = false,
  printModel,
  paymentInputRef = EMPTY_INPUT_REF,
  formBodyRef = EMPTY_BODY_REF,
  onSaved,
  onDeleted = () => undefined,
}: {
  building: { id: number; name: string };
  unit: SettlementContext["unit"];
  draft: MovingSettlementValues;
  input: SaveSettlementInput;
  settlementId: number | null;
  amount: number;
  receivedAmount?: number;
  /** 확정 부과분 미납액(0171). 정본 미수금 식(정산 금액+미납 소계−수납액)의 미납 소계. */
  billingUnpaid?: number;
  /** 셋업 > 이사정산 설정. auto 면 퇴실 처리 때 확정 부과분 미납이 자동수납되고, manual 이면 미수금으로 남는다. */
  vacancyPaymentMode?: "manual" | "auto";
  createdAt?: string | null;
  /** 중도퇴실·퇴실완료 건(정책 3.12 "완료 후 폼·액션 잠금"). 중도퇴실·삭제를 막는다. */
  locked?: boolean;
  /**
   * 퇴실완료 건만 true — 저장·퇴실까지 막는다. 중도퇴실 건은 나중에(다음 세입자 입주·만기) 값을 고쳐 저장하고
   * 「정산완료+퇴실」로 완전 퇴실해야 하므로 두 버튼을 열어 둔다(2026-08-11 회의, 0296).
   */
  completedLocked?: boolean;
  printModel: SettlementStatementPrintModel;
  paymentInputRef?: RefObject<HTMLInputElement | null>;
  /** 폼 본문 스크롤 영역(정본 #msBody). [수납액 입력]이 이 영역을 수납액 칸까지 부드럽게 올린다. */
  formBodyRef?: RefObject<HTMLDivElement | null>;
  onSaved: (id: number) => void;
  onDeleted?: () => void;
}) {
  const save = useSaveSettlement();
  const complete = useCompleteSettlement();
  const mid = useMidMoveout();
  const remove = useDeleteSettlement();
  const [dialog, setDialog] = useState<DialogState>(null);
  // 미수금 경고가 어느 완료(중도퇴실·퇴실) 앞에서 떴는지 — 제목에 쓴다.
  const [pendingCompletion, setPendingCompletion] = useState<"mid" | "moveout" | null>(null);
  // 이 화면에서 방금 완료 처리한 건도 컨텍스트 재조회 전까지 잠근다.
  const [finalized, setFinalized] = useState<"mid" | "moveout" | null>(null);
  const isLocked = locked || finalized !== null;
  const isCompletedLocked = completedLocked || finalized === "moveout";
  const isSettlementMutationPending =
    save.isPending || complete.isPending || mid.isPending || remove.isPending;
  const pendingAction = save.isPending
    ? "save"
    : mid.isPending
      ? "mid"
      : complete.isPending
        ? "moveout"
        : remove.isPending
          ? "delete"
          : null;
  // 정본 msCalc `due = (공과금+관리비+기타+미납 소계) − 수납액` — 하단 요약바 미수금과 같은 식이다.
  // amount 는 settlement_amount 정의(수납 차감 전 ①+②+③미납+④, 0266)라 미납이 이미 들어 있다.
  const outstanding = amount - receivedAmount;

  /** scope "completed" = 퇴실완료 건만 막는 동작(저장·퇴실), "all" = 중도퇴실 건도 막는 동작(중도퇴실·삭제). */
  const rejectLocked = (scope: "all" | "completed" = "all") => {
    if (!(scope === "completed" ? isCompletedLocked : isLocked)) return false;
    toast.info("완료된 이사정산은 수정할 수 없어요.");
    return true;
  };

  const validate = () => {
    const result = movingSettlementSchema.safeParse(draft);
    if (!result.success) toast.error("퇴실일과 금액 입력값을 확인해 주세요.");
    return result.success;
  };

  const requireSaved = () => {
    if (settlementId !== null) return true;
    toast.error("먼저 저장을 실행해 주세요.");
    return false;
  };

  const saveNow = () => {
    if (rejectLocked("completed") || !validate()) return;
    save.mutate(input, {
      onSuccess: (result) => {
        onSaved(result.settlementId);
        toast.success("이사정산을 저장했어요.");
      },
      onError: () => toast.error("이사정산 저장에 실패했어요."),
    });
  };

  // 완료 가드(명세 3.12). 사용자 결정 2026-09-18:
  //  · "미수금" 은 정산건 미수금(정산금액-수납액)과 billing 미납(확정부과-유효수납) **둘 다**.
  //  · 자동수납(auto)이 있어도 중도퇴실 경로가 따로 있으므로 **auto 예외를 두지 않는다** — 두 액션 모두 확인.
  // 사용자 결정 2026-09-30(QA W09): 정본대로 [취소][수납액 입력] 두 버튼 — 미수금이 남으면 완료하지 않는다
  // ("그래도 처리" 삭제). 미수금은 정본 식이라 확정 부과분 미납까지 수납액으로 맞추면 통과한다.
  const confirmDialogOf = (kind: "mid" | "moveout") =>
    kind === "mid" ? ("mid-confirm" as const) : ("moveout-confirm" as const);

  const requestCompletion = (kind: "mid" | "moveout") => {
    if (rejectLocked(kind === "moveout" ? "completed" : "all") || !validate() || !requireSaved()) return;
    if (outstanding > 0) {
      setPendingCompletion(kind);
      setDialog("outstanding");
      return;
    }
    setDialog(confirmDialogOf(kind));
  };

  const completeMidMoveout = () => {
    if (settlementId === null) return;
    mid.mutate(settlementId, {
      onSuccess: () => {
        setFinalized("mid");
        setDialog(null);
        toast.success("중도퇴실로 처리 완료했어요.");
      },
      onError: (error) =>
        toast.error(
          // 재사용된 occupancy 에 새 입주자가 들어온 경우 RPC 가 가드 메시지를 던진다(0275).
          error.message.includes("새 입주자") ? error.message : "중도퇴실 처리에 실패했어요.",
        ),
    });
  };

  const completeMoveout = () => {
    if (settlementId === null) return;
    complete.mutate(settlementId, {
      onSuccess: (result) => {
        setFinalized("moveout");
        setDialog(null);
        const collected = result.collected_count ?? 0;
        toast.success(
          collected > 0
            ? `퇴실로 처리 완료했어요. 미납 ${collected}건을 자동 수납했어요.`
            : "퇴실로 처리 완료했어요.",
        );
      },
      onError: (error) =>
        toast.error(
          // 재사용된 occupancy 에 새 입주자가 들어온 경우 RPC 가 가드 메시지를 던진다(0275).
          error.message.includes("새 입주자") ? error.message : "퇴실 처리에 실패했어요.",
        ),
    });
  };

  const deleteSettlement = () => {
    if (settlementId === null) {
      setDialog(null);
      toast.info("아직 저장되지 않은 입력이에요.");
      return;
    }
    remove.mutate(settlementId, {
      onSuccess: () => {
        setDialog(null);
        onDeleted();
        toast.success("이사정산을 삭제했어요.");
      },
      onError: (error) =>
        toast.error(
          // 완료·중간퇴실 건은 deleteMovingSettlement 가 상태 가드 메시지를 던진다.
          error.message.includes("삭제할 수 없습니다")
            ? error.message
            : "이사정산을 삭제하지 못했어요.",
        ),
    });
  };

  // 정본 msConfirm [수납액 입력]: 모달을 닫고 폼 본문을 수납액 칸이 가운데보다 40px 위에 오도록 부드럽게 올린 뒤
  // 0.32초 뒤에 포커스하고 값을 전체 선택한다(스크롤과 같이 focus 하면 브라우저가 스크롤을 곧바로 점프시킨다).
  const focusPayment = () => {
    setDialog(null);
    const input = paymentInputRef.current;
    const body = formBodyRef.current;
    if (!input) return;
    if (body) {
      const top =
        input.getBoundingClientRect().top -
        body.getBoundingClientRect().top +
        body.scrollTop -
        body.clientHeight / 2 +
        40;
      body.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 320);
  };

  const print = () => {
    if (outstanding < 0) {
      toast.error("미수금이 음수인 정산은 내역서를 출력할 수 없어요.");
      return;
    }
    printSettlementStatement(printModel);
  };

  const outstandingDialog = dialog === "outstanding";

  return (
    <>
      <SettlementActionBar
        onSave={saveNow}
        onMidMoveout={() => requestCompletion("mid")}
        onMoveout={() => requestCompletion("moveout")}
        onPrint={print}
        onBlankPrint={() => printSettlementStatement(printModel, { blank: true })}
        onDelete={() => {
          if (!rejectLocked()) setDialog("delete");
        }}
        pending={isSettlementMutationPending}
        locked={isLocked}
        completedLocked={isCompletedLocked}
        pendingAction={pendingAction}
      />

      {/* 정본: `미수금 <b>N원</b>이 남아 있어요.<br>수납액을 먼저 입력해 미수금을 0원으로 맞춘 뒤 처리할 수 있어요.` */}
      <SettlementDecisionDialog
        open={outstandingDialog}
        title={pendingCompletion === "mid" ? "중도퇴실 처리 전 확인" : "퇴실 처리 전 확인"}
        confirmLabel="수납액 입력"
        onCancel={() => setDialog(null)}
        onConfirm={focusPayment}
      >
        <p>
          미수금 <strong className="font-bold text-red">{formatWon(outstanding)}</strong>이 남아 있어요.
          <br />
          수납액을 먼저 입력해 미수금을 0원으로 맞춘 뒤 처리할 수 있어요.
        </p>
      </SettlementDecisionDialog>

      {/* 정본 형식(제목·확인 버튼·첫 줄) + 작은 줄은 mid_moveout_settlement 가 실제로 바꾸는 값(0008).
          수납액이 확정 부과분 미납까지 덮어 여기 온 경우, 중도퇴실은 그 미납을 수납하지 않는다. */}
      <SettlementDecisionDialog
        open={dialog === "mid-confirm"}
        title="중도퇴실 처리"
        confirmLabel="정산완료+중도퇴실"
        pending={mid.isPending}
        pendingLabel="중도퇴실 처리 중…"
        onCancel={() => setDialog(null)}
        onConfirm={completeMidMoveout}
      >
        <p>
          {building.name} {unit.unitNo} 세대를 중도퇴실로 처리 완료 하시겠습니까?
          <br />
          <span className="text-[12.5px] text-t3">
            공실 처리 없이 고지서 출력 여부가 N으로, 부과시 참조사항이 &quot;중도퇴실&quot;로 바뀌어요.
            {billingUnpaid > 0 && ` 확정 부과분 미납 ${formatWon(billingUnpaid)}은 미수금으로 남아요.`}
          </span>
        </p>
      </SettlementDecisionDialog>

      {/* 작은 줄은 complete_moving_settlement 동작(퇴실일로 전출 이력 추가·공실 전환, 0167). 확정 부과분 미납이 남아 있으면
          셋업 > 이사정산 설정의 공실 수납 방식대로 자동수납되거나(auto) 미수금으로 남는다(manual). */}
      <SettlementDecisionDialog
        open={dialog === "moveout-confirm"}
        title="퇴실 처리"
        confirmLabel="정산완료+퇴실"
        pending={complete.isPending}
        pendingLabel="퇴실 처리 중…"
        onCancel={() => setDialog(null)}
        onConfirm={completeMoveout}
      >
        <p>
          {building.name} {unit.unitNo} 세대를 퇴실로 처리 완료 하시겠습니까?
          <br />
          <span className="text-[12.5px] text-t3">
            퇴실일로 전출 정보에 추가되고 입주자 정보가 초기화돼요.
            {billingUnpaid > 0 &&
              (vacancyPaymentMode === "auto"
                ? ` 확정 부과분 미납 ${formatWon(billingUnpaid)}은 자동으로 수납 처리돼요.`
                : ` 공실 수납 방식이 수동이라 확정 부과분 미납 ${formatWon(billingUnpaid)}은 미수금으로 남아요.`)}
          </span>
        </p>
      </SettlementDecisionDialog>

      <SettlementDecisionDialog
        open={dialog === "delete"}
        title="이사정산 삭제"
        confirmLabel="삭제"
        confirmTone="danger"
        pending={remove.isPending}
        pendingLabel="삭제 중…"
        onCancel={() => setDialog(null)}
        onConfirm={deleteSettlement}
      >
        <p>해당 이사정산을 삭제하시겠습니까?</p>
        <p className="text-t3">{formatCreatedAt(createdAt)}이며, 삭제하면 되돌릴 수 없어요.</p>
      </SettlementDecisionDialog>
    </>
  );
}
