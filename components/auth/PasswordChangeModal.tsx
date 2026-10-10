"use client";

import { Button, Modal } from "@/components/common";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { PasswordChangeForm } from "./PasswordChangeForm";

/** 내 정보 > 비밀번호 변경. 현재 비밀번호는 보여주지 않고 새 비밀번호·확인만 받는다. */
export function PasswordChangeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="비밀번호 변경"
      className="flex max-h-[88vh] max-w-[min(420px,90vw)] flex-col rounded-[20px] px-0 pb-0 pt-[22px] leading-[normal] shadow-hf-modal [&>h2]:px-6 [&>h2]:text-[17px] [&>h2]:font-extrabold [&>h2]:leading-[normal] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      <p className="mt-[6px] px-6 text-[13px] font-medium leading-[normal] text-t3">
        보안을 위해 현재 비밀번호는 표시하지 않아요.
      </p>
      <div className="min-h-0 flex-1 overflow-auto px-6 pb-5 pt-[18px]">
        {open && (
          <PasswordChangeForm
            variant="modal"
            submitLabel="변경"
            onSuccess={() => {
              toast.success("비밀번호를 변경했어요");
              onClose();
            }}
            secondaryAction={
              <Button type="button" size="std" variant="ghost" onClick={onClose}>
                취소
              </Button>
            }
          />
        )}
      </div>
    </Modal>
  );
}
