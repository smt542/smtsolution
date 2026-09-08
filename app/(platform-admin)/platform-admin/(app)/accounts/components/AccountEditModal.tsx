"use client";

import { useState } from "react";
import { Input, Modal } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import type { PlatformAccount } from "@/hooks/reactquery/platform";
import { ModalActions } from "../../../../_components/ModalActions";
import { InlineAlert } from "../../../../_components/InlineAlert";

export interface AccountEditValues {
  fullName: string;
  phone: string;
  memo: string;
}

interface Props {
  account: PlatformAccount;
  onClose: () => void;
  onSubmit: (values: AccountEditValues) => Promise<void>;
  isPending: boolean;
}

const INPUT_CLASS =
  "h-[42px] rounded-[10px] border border-line bg-surface px-[13px] text-[13.5px] font-semibold text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t";
const FORM_FIELD_CLASS =
  "[&>label]:mb-1.5 [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:text-t2";

export function AccountEditModal({ account, onClose, onSubmit, isPending }: Props) {
  const [fullName, setFullName] = useState(account.fullName ?? "");
  const [phone, setPhone] = useState(account.phone ?? "");
  const [memo, setMemo] = useState(account.memo ?? "");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = fullName.trim();
    if (!normalizedName) {
      setError("이름을 입력해 주세요.");
      return;
    }

    setError("");
    await onSubmit({
      fullName: normalizedName,
      phone: phone.trim(),
      memo: memo.trim(),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="계정 정보 편집"
      className="max-w-[480px] rounded-[20px] [&>h2]:text-[17px] [&>h2]:font-extrabold [&>h2]:tracking-[-0.02em]"
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <p className="text-sm text-t2">
          <b>{account.username ?? account.userId}</b> · {account.organizationName}
        </p>

        <FormField label="이름" htmlFor="platform-account-edit-name" className={FORM_FIELD_CLASS}>
          <Input
            id="platform-account-edit-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={100}
            autoFocus
            className={INPUT_CLASS}
          />
        </FormField>

        <FormField label="전화번호" htmlFor="platform-account-edit-phone" className={FORM_FIELD_CLASS}>
          <Input
            id="platform-account-edit-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={30}
            placeholder="010-0000-0000"
            className={INPUT_CLASS}
          />
        </FormField>

        <FormField label="메모" htmlFor="platform-account-edit-memo" className={FORM_FIELD_CLASS}>
          <textarea
            id="platform-account-edit-memo"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            maxLength={500}
            rows={4}
            placeholder="담당 업무 · 비고"
            className="w-full resize-none rounded-[10px] border border-line bg-surface px-[13px] py-3 text-[13.5px] font-semibold text-t1 outline-none placeholder:text-t4 focus:border-blue focus:ring-[3px] focus:ring-blue-t"
          />
        </FormField>

        {error && (
          <InlineAlert tone="dangerStrong" role="alert">
            {error}
          </InlineAlert>
        )}

        <ModalActions>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="h-10 rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold text-t2 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-70"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 rounded-[11px] bg-blue px-[15px] text-[13.5px] font-bold text-white shadow-hf-btn hover:bg-blue-d disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "저장 중…" : "저장"}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}
