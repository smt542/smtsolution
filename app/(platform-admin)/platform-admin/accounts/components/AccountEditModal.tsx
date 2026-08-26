"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/components/common";
import type { PlatformAccount } from "@/hooks/reactquery/platform";

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
    <Modal open onClose={onClose} title="계정 정보 편집">
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <p className="text-sm text-t2">
          <b>{account.username ?? account.userId}</b> · {account.organizationName}
        </p>

        <Field label="이름" htmlFor="platform-account-edit-name">
          <Input
            id="platform-account-edit-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={100}
            autoFocus
          />
        </Field>

        <Field label="전화번호" htmlFor="platform-account-edit-phone">
          <Input
            id="platform-account-edit-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={30}
            placeholder="010-0000-0000"
          />
        </Field>

        <Field label="메모" htmlFor="platform-account-edit-memo">
          <textarea
            id="platform-account-edit-memo"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            maxLength={500}
            rows={4}
            placeholder="담당 업무 · 비고"
            className="w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm text-t1 outline-none focus:border-blue focus:ring-4 focus:ring-blue/10"
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-xl bg-red-t px-3 py-2 text-sm font-semibold text-red">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-t3">
        {label}
      </label>
      {children}
    </div>
  );
}
