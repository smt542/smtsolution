"use client";

import { Modal } from "@/components/common";
import type { MessagingPreset } from "@/lib/messaging/preset";
import type { SendMessagesResult } from "@/hooks/reactquery/messaging";
import { MessagingComposer } from "./MessagingComposer";

export interface MessagingModalProps {
  open: boolean;
  preset?: MessagingPreset;
  onClose: () => void;
  onSent?: (result: SendMessagesResult) => void | Promise<void>;
  onFailed?: (error: unknown) => void | Promise<void>;
}

export function MessagingModal({
  open,
  preset,
  onClose,
  onSent,
  onFailed,
}: MessagingModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={preset?.channel === "alimtalk" ? "카톡 고지서 발송" : "문자 발송"}>
      <MessagingComposer
        preset={preset}
        onSent={onSent}
        onFailed={onFailed}
        initialMode={preset?.mode ?? preset?.channel ?? "sms"}
      />
    </Modal>
  );
}
