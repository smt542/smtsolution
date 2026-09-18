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
  occupancy,
  draft,
  input,
  settlementId,
  amount,
  receivedAmount = 0,
  billingUnpaid = 0,
  vacancyPaymentMode = "auto",
  createdAt = null,
  printModel,
  paymentInputRef = EMPTY_INPUT_REF,
  onSaved,
  onDeleted = () => undefined,
}: {
  building: { id: number; name: string };
  unit: SettlementContext["unit"];
  occupancy: NonNullable<SettlementContext["occupancy"]>;
  draft: MovingSettlementValues;
  input: SaveSettlementInput;
  settlementId: number | null;
  amount: number;
  receivedAmount?: number;
  /** 확정 부과분 미납액(0171). 정산건 미수금과는 다른 숫자이고, 완료 가드는 둘 다 본다. */
  billingUnpaid?: number;
  /** 셋업 > 이사정산 설정. auto 면 퇴실 처리 시 미납이 자동수납되고, manual 이면 미수금이 남는다. */
  vacancyPaymentMode?: "manual" | "auto";
  createdAt?: string | null;
  printModel: SettlementStatementPrintModel;
  paymentInputRef?: RefObject<HTMLInputElement | null>;
  onSaved: (id: number) => void;
  onDeleted?: () => void;
}) {
  const save = useSaveSettlement();
  const complete = useCompleteSettlement();
  const mid = useMidMoveout();
  const remove = useDeleteSettlement();
  const [dialog, setDialog] = useState<DialogState>(null);
  // 미수금 경고에서 "그래도 처리" 를 눌렀을 때 어느 완료 확인으로 넘길지 기억한다.
  const [pendingCompletion, setPendingCompletion] = useState<"mid" | "moveout" | null>(null);
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
  const outstanding = amount - receivedAmount;

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
    if (!validate()) return;
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
  //  · 서버 하드블록은 넣지 않는다 → 경고 후 "그래도 처리" 로 진행할 수 있다.
  const confirmDialogOf = (kind: "mid" | "moveout") =>
    kind === "mid" ? ("mid-confirm" as const) : ("moveout-confirm" as const);

  const requestCompletion = (kind: "mid" | "moveout") => {
    if (!validate() || !requireSaved()) return;
    if (outstanding > 0 || billingUnpaid > 0) {
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
        setDialog(null);
        toast.success("중도퇴실로 처리 완료했어요.");
      },
      onError: () => toast.error("중도퇴실 처리에 실패했어요."),
    });
  };

  const completeMoveout = () => {
    if (settlementId === null) return;
    complete.mutate(settlementId, {
      onSuccess: (result) => {
        setDialog(null);
        const collected = result.collected_count ?? 0;
        toast.success(
          collected > 0
            ? `퇴실로 처리 완료했어요. 미납 ${collected}건을 자동 수납했어요.`
            : "퇴실로 처리 완료했어요.",
        );
      },
      onError: () => toast.error("퇴실 처리에 실패했어요."),
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
      onError: () => toast.error("이사정산을 삭제하지 못했어요."),
    });
  };

  const focusPayment = () => {
    setDialog(null);
    window.setTimeout(() => {
      paymentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      paymentInputRef.current?.focus();
    }, 0);
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
        onDelete={() => setDialog("delete")}
        pending={isSettlementMutationPending}
        pendingAction={pendingAction}
      />

      <SettlementDecisionDialog
        open={outstandingDialog}
        title={pendingCompletion === "mid" ? "중도퇴실 처리 전 확인" : "퇴실 처리 전 확인"}
        confirmLabel="그래도 처리"
        confirmTone="danger"
        pending={false}
        secondaryLabel="수납액 입력"
        onSecondary={focusPayment}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (pendingCompletion) setDialog(confirmDialogOf(pendingCompletion));
        }}
      >
        {outstanding > 0 && (
          <p>
            이 정산의 미수금 <strong className="font-bold text-red">{formatWon(outstanding)}</strong>이 남아 있어요.
          </p>
        )}
        {billingUnpaid > 0 && (
          <p>
            확정 부과분 미납 <strong className="font-bold text-red">{formatWon(billingUnpaid)}</strong>이 남아 있어요.
          </p>
        )}
        <p>수납액을 먼저 입력해 0원으로 맞추는 것을 권해요. 그대로 처리하면 미수금이 남은 채 완료돼요.</p>
      </SettlementDecisionDialog>

      <SettlementDecisionDialog
        open={dialog === "mid-confirm"}
        title="중도퇴실 처리 전 확인"
        confirmLabel="중도퇴실 처리"
        pending={mid.isPending}
        pendingLabel="중도퇴실 처리 중…"
        onCancel={() => setDialog(null)}
        onConfirm={completeMidMoveout}
      >
        <p>{building.name} {unit.unitNo} 세대를 중도퇴실로 처리할까요?</p>
        <p>{occupancy.tenantName ?? "입주자 미등록"}의 정산 상태가 완료로 변경돼요.</p>
      </SettlementDecisionDialog>

      {/* 문구는 셋업 > 이사정산 설정의 공실 수납 방식에 따라 갈린다(0167). */}
      <SettlementDecisionDialog
        open={dialog === "moveout-confirm"}
        title="퇴실 처리 전 확인"
        confirmLabel="퇴실 처리"
        pending={complete.isPending}
        pendingLabel="퇴실 처리 중…"
        onCancel={() => setDialog(null)}
        onConfirm={completeMoveout}
      >
        {vacancyPaymentMode === "auto" ? (
          <>
            <p>{building.name} {unit.unitNo} 세대의 미납 관리비를 수납 처리하시겠습니까?</p>
            <p>확인하면 남은 미납 관리비가 자동으로 수납 처리되고, 입주자 정보가 초기화되며 세대가 공실로 전환돼요.</p>
          </>
        ) : (
          <>
            <p>{building.name} {unit.unitNo} 세대를 퇴실로 처리할까요?</p>
            <p>확인하면 입주자 정보가 초기화되며 세대가 공실로 전환돼요. 공실 수납 방식이 <b>수동</b>이라 남은 미납 관리비는 <b>수납되지 않고 미수금으로 남아요</b> — 수납관리 화면에서 따로 처리해 주세요.</p>
          </>
        )}
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
