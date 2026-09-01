"use client";

import type { RefObject } from "react";
import { useState } from "react";
import { toast } from "sonner";
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
  | "moveout-outstanding"
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
  const pending = save.isPending || complete.isPending || mid.isPending || remove.isPending;
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
      onError: () => toast.error("이사정산 저장에 실패했습니다."),
    });
  };

  const requestCompletion = (kind: "mid" | "moveout") => {
    if (!validate() || !requireSaved()) return;
    if (outstanding > 0) {
      setDialog(kind === "mid" ? "mid-outstanding" : "moveout-outstanding");
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
      onError: () => toast.error("중도퇴실 처리에 실패했습니다."),
    });
  };

  const completeMoveout = () => {
    if (settlementId === null) return;
    complete.mutate(settlementId, {
      onSuccess: () => {
        setDialog(null);
        toast.success("퇴실로 처리 완료했어요.");
      },
      onError: () => toast.error("퇴실 처리에 실패했습니다."),
    });
  };

  const deleteSettlement = () => {
    if (settlementId === null) {
      setDialog(null);
      toast.info("아직 저장되지 않은 입력입니다.");
      return;
    }
    remove.mutate(settlementId, {
      onSuccess: () => {
        setDialog(null);
        onDeleted();
        toast.success("이사정산을 삭제했어요.");
      },
      onError: () => toast.error("이사정산을 삭제하지 못했습니다."),
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
      toast.error("미수금이 음수인 정산은 내역서를 출력할 수 없습니다.");
      return;
    }
    window.print();
  };

  const outstandingDialog = dialog === "mid-outstanding" || dialog === "moveout-outstanding";

  return (
    <>
      <SettlementActionBar
        onSave={saveNow}
        onMidMoveout={() => requestCompletion("mid")}
        onMoveout={() => requestCompletion("moveout")}
        onPrint={print}
        onBlankPrint={() => window.print()}
        onDelete={() => setDialog("delete")}
        pending={pending}
      />

      <SettlementDecisionDialog
        open={outstandingDialog}
        title={dialog === "mid-outstanding" ? "중도퇴실 처리 전 확인" : "퇴실 처리 전 확인"}
        confirmLabel="수납액 입력"
        pending={pending}
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
        pending={pending}
        onCancel={() => setDialog(null)}
        onConfirm={completeMidMoveout}
      >
        <p>{building.name} {unit.unitNo} 세대를 중도퇴실로 처리할까요?</p>
        <p>{occupancy.tenantName ?? "입주자 미등록"}의 정산 상태가 완료로 변경돼요.</p>
      </SettlementDecisionDialog>

      <SettlementDecisionDialog
        open={dialog === "moveout-confirm"}
        title="퇴실 처리 전 확인"
        confirmLabel="퇴실 처리"
        pending={pending}
        onCancel={() => setDialog(null)}
        onConfirm={completeMoveout}
      >
        <p>{building.name} {unit.unitNo} 세대를 퇴실 처리할까요?</p>
        <p>처리하면 입주자 정보가 초기화되고 세대가 공실로 전환돼요.</p>
      </SettlementDecisionDialog>

      <SettlementDecisionDialog
        open={dialog === "delete"}
        title="이사정산 삭제"
        confirmLabel="삭제"
        confirmTone="danger"
        pending={pending}
        onCancel={() => setDialog(null)}
        onConfirm={deleteSettlement}
      >
        <p>해당 이사정산을 삭제하시겠습니까?</p>
        <p className="text-t3">{formatCreatedAt(createdAt)}이며, 삭제하면 되돌릴 수 없어요.</p>
      </SettlementDecisionDialog>
    </>
  );
}
