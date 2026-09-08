"use client";
import React, { useState } from "react";
import { Modal, Button } from "@/components/common";

interface Props {
  open: boolean;
  unitNo: string;
  billingNote: string;
  unitNotice: string;
  onClose: () => void;
  onSave: (v: { billingNote: string; unitNotice: string }) => void;
}

export function BillingNoteModal({ open, unitNo, billingNote, unitNotice, onClose, onSave }: Props) {
  const [b, setB] = useState(billingNote);
  const [n, setN] = useState(unitNotice);
  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setB(billingNote);
      setN(unitNotice);
    }
  }, [open, billingNote, unitNotice]);
  return (
    <Modal open={open} onClose={onClose} title={`${unitNo} · 부과 메모`}>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-t2">부과 참조사항</span>
        <textarea
          aria-label="부과 참조사항"
          value={b}
          onChange={(e) => setB(e.target.value)}
          className="h-20 w-full rounded border border-line p-2 text-sm"
        />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-bold text-t2">호실별 공지사항</span>
        <textarea
          aria-label="호실별 공지사항"
          value={n}
          onChange={(e) => setN(e.target.value)}
          className="h-20 w-full rounded border border-line p-2 text-sm"
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>취소</Button>
        <Button variant="primary" onClick={() => onSave({ billingNote: b, unitNotice: n })}>저장</Button>
      </div>
    </Modal>
  );
}
