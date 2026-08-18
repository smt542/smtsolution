"use client";

import { Modal } from "@/components/common";
import type { MessagingPreset } from "@/lib/messaging/preset";
import { MessagingComposer } from "./MessagingComposer";

export interface MessagingModalProps {
  open: boolean;
  preset?: MessagingPreset;
  onClose: () => void;
  onSent?: (result: { logId: number; count: number }) => void;
}

export function MessagingModal({
  open,
  preset,
  onClose,
  onSent,
}: MessagingModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="문자 발송">
      <MessagingComposer
        preset={preset}
        onSent={onSent}
        initialMode="sms"
      />
    </Modal>
  );
}
