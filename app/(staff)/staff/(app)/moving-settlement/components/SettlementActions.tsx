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

type DialogState =
  | "mid-outstanding"
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
  vacancyPaymentMode = "auto",
  createdAt = null,
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
  /** 셋업 > 이사정산 설정. auto 면 퇴실 처리 시 미납이 자동수납되고, manual 이면 미수금이 남는다. */
  vacancyPaymentMode?: "manual" | "auto";
  createdAt?: string | null;
  paymentInputRef?: RefObject<HTMLInputElement | null>;
  onSaved: (id: number) => void;
  onDeleted?: () => void;
}) {
  const save = useSaveSettlement();
  const complete = useCompleteSettlement();
  const mid = useMidMoveout();
  const remove = useDeleteSettlement();
  const [dialog, setDialog] = useState<DialogState>(null);
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

  const requestCompletion = (kind: "mid" | "moveout") => {
    if (!validate() || !requireSaved()) return;
    // 중도퇴실은 공실/자동수납이 없으므로 미수금이 남아 있으면 수납 입력을 먼저 안내한다.
    // 정산완료+공실(퇴실)은 PRD상 미납 관리비를 자동 수납하므로 막지 않고 확인 팝업으로 바로 진행한다.
    if (kind === "mid" && outstanding > 0) {
      setDialog("mid-outstanding");
      return;
    }
    setDialog(kind === "mid" ? "mid-confirm" : "moveout-confirm");
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
    window.print();
  };

  const outstandingDialog = dialog === "mid-outstanding";

  return (
    <>
      <SettlementActionBar
        onSave={saveNow}
        onMidMoveout={() => requestCompletion("mid")}
        onMoveout={() => requestCompletion("moveout")}
        onPrint={print}
        onBlankPrint={() => window.print()}
        onDelete={() => setDialog("delete")}
        pending={isSettlementMutationPending}
        pendingAction={pendingAction}
      />

      <SettlementDecisionDialog
        open={outstandingDialog}
        title="중도퇴실 처리 전 확인"
        confirmLabel="수납액 입력"
        pending={false}
        onCancel={() => setDialog(null)}
        onConfirm={focusPayment}
      >
        <p>
          미수금 <strong className="font-bold text-red">{formatWon(outstanding)}</strong>이 남아 있어요.
        </p>
        <p>수납액을 먼저 입력해 미수금을 0원으로 맞춘 뒤 처리할 수 있어요.</p>
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
