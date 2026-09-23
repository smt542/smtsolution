"use client";

import { Modal } from "@/components/common";
import type { MessagingPreset } from "@/lib/messaging/preset";
import type { SendMessagesResult } from "@/hooks/reactquery/messaging";
import { MessagingComposer } from "./MessagingComposer";
import { MessagingWorkspaceShell } from "./MessagingWorkspaceShell";

export interface MessagingModalProps {
  open: boolean;
  preset?: MessagingPreset;
  onClose: () => void;
  onSent?: (result: SendMessagesResult) => void | Promise<void>;
  onFailed?: (error: unknown) => void | Promise<void>;
  presentation?: "modal" | "workspace";
  itemCount?: number;
}

export function MessagingModal({
  open,
  preset,
  onClose,
  onSent,
  onFailed,
  presentation = "modal",
  itemCount,
}: MessagingModalProps) {
  if (!open) return null;

  if (presentation === "workspace") {
    return (
      <MessagingWorkspaceShell onClose={onClose}>
        <MessagingComposer
          preset={preset}
          onSent={onSent}
          onFailed={onFailed}
          initialMode={preset?.mode ?? preset?.channel ?? "sms"}
          presentation="workspace"
          itemCount={itemCount}
        />
      </MessagingWorkspaceShell>
    );
  }

  return (
    // 작성기가 화면보다 길어(약 1,200px) 위아래가 잘리고 발송 버튼에 닿지 못해 패널 안에서 스크롤한다
    <Modal
      open={open}
      onClose={onClose}
      title={preset?.channel === "alimtalk" ? "카톡 고지서 발송" : "문자 발송"}
      className="max-w-md max-h-[calc(100dvh-32px)] overflow-y-auto"
    >
      <MessagingComposer
        preset={preset}
        onSent={onSent}
        onFailed={onFailed}
        initialMode={preset?.mode ?? preset?.channel ?? "sms"}
      />
    </Modal>
  );
}
