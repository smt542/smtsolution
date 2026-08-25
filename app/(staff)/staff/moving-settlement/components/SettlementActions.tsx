"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Modal } from "@/components/common";
import {
  movingSettlementSchema,
  type MovingSettlementValues,
} from "@/components/forms/schema/movingSettlement";
import {
  useCompleteSettlement,
  useMidMoveout,
  useSaveSettlement,
  type SaveSettlementInput,
  type SettlementContext,
} from "@/hooks/reactquery/movingSettlement";
import { useOrgContact } from "@/hooks/reactquery/org/useOrgContact";
import { formatDate, formatKrw, formatUnit } from "@/lib/messaging/vars";
import { MessagingModal } from "../../messaging/components/MessagingModal";

export function SettlementActions({
  building,
  unit,
  occupancy,
  draft,
  input,
  settlementId,
  amount,
  onSaved,
}: {
  building: { id: number; name: string };
  unit: SettlementContext["unit"];
  occupancy: NonNullable<SettlementContext["occupancy"]>;
  draft: MovingSettlementValues;
  input: SaveSettlementInput;
  settlementId: number | null;
  amount: number;
  onSaved: (id: number) => void;
}) {
  const save = useSaveSettlement();
  const complete = useCompleteSettlement();
  const mid = useMidMoveout();
  const { data: orgContact } = useOrgContact();
  const [messageOpen, setMessageOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const pending = save.isPending || complete.isPending || mid.isPending;

  const validate = () => {
    const result = movingSettlementSchema.safeParse(draft);
    if (!result.success) {
      toast.error("퇴실일과 금액 입력값을 확인해 주세요.");
    }
    return result.success;
  };

  const calculate = () => {
    if (validate()) {
      toast.success(`정산금은 ${amount.toLocaleString("ko-KR")}원입니다.`);
    }
  };

  const saveNow = () => {
    if (!validate()) return;

    save.mutate(input, {
      onSuccess: (result) => {
        onSaved(result.settlementId);
        toast.success("이사정산을 저장했습니다.");
      },
      onError: () => toast.error("이사정산 저장에 실패했습니다."),
    });
  };

  const midMoveout = () => {
    if (settlementId === null) {
      toast.error("먼저 계산+저장을 실행해 주세요.");
      return;
    }
    if (!window.confirm("중도퇴실로 처리하시겠습니까?")) return;

    mid.mutate(settlementId, {
      onSuccess: () => toast.success("중도퇴실로 처리했습니다."),
      onError: () => toast.error("중도퇴실 처리에 실패했습니다."),
    });
  };

  const completeNow = () => {
    if (settlementId === null) {
      toast.error("먼저 계산+저장을 실행해 주세요.");
      setCompleteOpen(false);
      return;
    }

    complete.mutate(settlementId, {
      onSuccess: () => {
        setCompleteOpen(false);
        toast.success("정산을 완료하고 공실로 전환했습니다.");
      },
      onError: () => toast.error("정산완료 처리에 실패했습니다."),
    });
  };

  const exportStub = (label: string) =>
    toast.info(`${label} 출력은 엑셀 연동 후 제공됩니다.`);

  return (
    <>
      <section className="flex flex-wrap justify-end gap-2 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <Button variant="ghost" onClick={() => setMessageOpen(true)}>
          정산내역서 전송
        </Button>
        <Button variant="ghost" onClick={() => exportStub("빈양식")}>
          빈양식
        </Button>
        <Button variant="ghost" onClick={calculate} disabled={pending}>
          정산금 계산
        </Button>
        <Button onClick={saveNow} disabled={pending}>
          계산+저장
        </Button>
        <Button variant="ghost" onClick={midMoveout} disabled={pending}>
          중도퇴실
        </Button>
        <Button
          variant="danger"
          onClick={() => setCompleteOpen(true)}
          disabled={pending}
        >
          정산완료+공실
        </Button>
      </section>

      <MessagingModal
        open={messageOpen}
        preset={{
          context: "이사정산",
          buildingId: building.id,
          channel: "alimtalk",
          mode: "auto",
          templateTitle: "이사정산 내역서",
          recipients: [{
            name: occupancy.tenantName,
            phone: occupancy.phone,
            unitNo: formatUnit(unit.dong, unit.unitNo),
            kind: "tenant",
            variables: {
              퇴실일: formatDate(draft.moveOutDate),
              정산구분: amount < 0 ? "환급" : "추가납부",
              정산금액: formatKrw(amount),
              세대: formatUnit(unit.dong, unit.unitNo),
            },
            ref: { occupancyId: occupancy.id },
          }],
          commonVariables: {
            건물명: building.name,
            관리사무소연락처: orgContact?.phone ?? "",
          },
        }}
        onClose={() => setMessageOpen(false)}
        onSent={(result) => {
          toast.success(`이사정산 내역서 ${result.count}건 발송을 접수했습니다.`);
          setMessageOpen(false);
        }}
      />

      <Modal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="미납 수납 확인"
      >
        <p className="text-sm text-t2">
          미납 수납 기능은 아직 연결되지 않았습니다. 미납 여부를 별도로
          확인한 뒤 공실 처리해 주세요.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCompleteOpen(false)}>
            취소
          </Button>
          <Button variant="danger" onClick={completeNow}>
            확인하고 완료
          </Button>
        </div>
      </Modal>
    </>
  );
}
