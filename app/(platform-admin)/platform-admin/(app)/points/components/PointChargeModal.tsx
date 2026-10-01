"use client";
import { useState, type FormEvent } from "react";
import { Button, Input, Modal } from "@/components/common";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { formatNumber } from "@/lib/format";

type PointChargeModalMode = "create" | "edit";

interface Props {
  open: boolean;
  onClose: () => void;
  mode?: PointChargeModalMode;
  initialAmount?: number;
  /** 충전 금액(원). 1원 = 1P */
  onSubmit: (amount: number) => Promise<void>;
  onDelete?: () => Promise<void>;
  isPending: boolean;
}

// 정본 admin/points #chScrim .modal: min(420px,90%)·r20·p24·줄높이 normal, 제목 17/800/-.02em
const MODAL_CLASS =
  "max-w-[min(420px,90%)] rounded-[20px] shadow-hf-modal leading-[normal] [&>h2]:text-[17px] [&>h2]:leading-[normal] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1";
// 정본 .hf-in2 — placeholder 규칙이 없어 브라우저 기본색
const INPUT_CLASS =
  "h-[42px] w-full rounded-[10px] border border-line bg-surface px-[13px] text-[13.5px] font-semibold text-t1 outline-none placeholder:text-[#757575] focus:border-blue focus:ring-[3px] focus:ring-blue-t";
// 정본 .ch-quick span
const QUICK_AMOUNTS = [
  { value: 500_000, label: "50만" },
  { value: 1_000_000, label: "100만" },
  { value: 3_000_000, label: "300만" },
  { value: 5_000_000, label: "500만" },
];

const digitsOf = (text: string) => text.replace(/[^0-9]/g, "");

/** 본사가 팝빌에서 결제한 금액을 기록한다(팝빌 잔액은 자동으로 못 가져온다) — 대상 조직 없음 */
export function PointChargeModal({
  open,
  onClose,
  mode = "create",
  initialAmount,
  onSubmit,
  onDelete,
  isPending,
}: Props) {
  const confirm = useConfirm();
  const [amount, setAmount] = useState(() => (
    mode === "edit" && initialAmount != null ? formatNumber(initialAmount) : ""
  ));
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const busy = isPending || submitting || confirming;

  const closeSafely = () => {
    if (!busy) onClose();
  };
  const changeAmount = (text: string) => {
    const digits = digitsOf(text);
    setAmount(digits ? formatNumber(Number(digits)) : "");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const value = Number(digitsOf(amount));
    if (!Number.isInteger(value) || value <= 0) {
      toast.warning("충전 금액을 입력해 주세요");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(value);
      onClose();
    } catch {
      // 실패 토스트는 호출부가 띄운다 — 입력값을 남긴 채 모달을 둔다
      setSubmitting(false);
    }
  };

  const deleteCharge = async () => {
    if (busy || mode !== "edit" || !onDelete) return;
    setConfirming(true);
    try {
      const accepted = await confirm({
        title: "충전 기록 삭제",
        description: `${formatNumber(initialAmount ?? Number(digitsOf(amount)))}P 충전 기록을 삭제합니다. 삭제하면 되돌릴 수 없어요.`,
        confirmLabel: "삭제",
        variant: "danger",
      });
      if (!accepted) return;

      setSubmitting(true);
      await onDelete();
      onClose();
    } catch {
      // 실패 토스트는 호출부가 띄운다 — 삭제에 실패하면 모달을 둔다
      setSubmitting(false);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={closeSafely}
      title={mode === "edit" ? "팝빌 포인트" : "팝빌 포인트 충전"}
      className={MODAL_CLASS}
      bodyClassName=""
    >
      <form onSubmit={submit} noValidate>
        <p className="mt-[7px] text-[13px] font-semibold leading-[1.55] text-t3">
          팝빌에서 결제한 충전 금액을 입력해 주세요. 1원 = 1P로 반영됩니다.
        </p>

        <div className="mt-4">
          <label htmlFor="pc-amount" className="mb-1.5 block text-[12.5px] font-bold text-t2">충전 금액</label>
          <Input
            unstyled
            id="pc-amount"
            inputMode="numeric"
            autoComplete="off"
            value={amount}
            onChange={(event) => changeAmount(event.target.value)}
            placeholder="1,000,000"
            className={INPUT_CLASS}
          />
          <div className="mt-[9px] flex gap-1.5">
            {QUICK_AMOUNTS.map((quick) => (
              <button
                key={quick.value}
                type="button"
                onClick={() => setAmount(formatNumber(quick.value))}
                className="flex-1 cursor-pointer rounded-[9px] border border-line py-2 text-center text-[12.5px] font-bold text-t2 hover:bg-bg"
              >
                {quick.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {mode === "edit" && (
            <>
              <Button
                type="button"
                variant="danger"
                onClick={() => void deleteCharge()}
                disabled={busy}
                className="border border-red"
              >
                삭제
              </Button>
              <div className="flex-1" />
            </>
          )}
          <Button type="button" variant="ghost" onClick={closeSafely} disabled={busy}>취소</Button>
          <Button type="submit" variant="primary" disabled={busy} className="border border-transparent">
            {mode === "edit" ? "수정" : "충전"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
