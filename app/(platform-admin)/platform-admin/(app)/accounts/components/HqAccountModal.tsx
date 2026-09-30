"use client";

import { useState, type FormEvent } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import {
  Button,
  CustomDropdown,
  Input,
  Modal,
  PhoneInput,
  SegmentedControl,
} from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import {
  useCreatePlatformHqAccount,
  useDeletePlatformHqAccount,
  usePlatformResetPassword,
  useUpdatePlatformHqAccount,
  type HqRole,
  type PlatformHqAccount,
} from "@/hooks/reactquery/platform";
import { HqPasswordInput } from "../../../../_components/HqPasswordInput";
import {
  ADMIN_DROPDOWN_MENU_CLASS,
  ADMIN_FORM_DROPDOWN_CLASS,
} from "../../../../_components/adminDropdownClasses";
import { HQ_ROLE_OPTIONS } from "../hqRoles";

type HqAccountModalProps = {
  mode: "create" | "edit";
  account?: PlatformHqAccount;
  onClose: () => void;
};

type FormValues = {
  fullName: string;
  hqRole: HqRole | "";
  phone: string;
  username: string;
  password: string;
  memo: string;
  isActive: boolean;
};

type InvalidField = "fullName" | "hqRole" | "phone" | "username" | "password";

const PHONE_PATTERN = /^01\d-\d{3,4}-\d{4}$/;
const PASSWORD_PATTERN = /^\d{4}$/;

function initialValues(mode: HqAccountModalProps["mode"], account?: PlatformHqAccount): FormValues {
  if (mode === "edit" && account) {
    return {
      fullName: account.fullName,
      hqRole: account.hqRole ?? "",
      phone: account.phone,
      username: account.username,
      password: "",
      memo: account.memo ?? "",
      isActive: account.isActive,
    };
  }

  return {
    fullName: "",
    hqRole: "",
    phone: "",
    username: "",
    password: "",
    memo: "",
    isActive: true,
  };
}

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div className="mb-[6px] text-[12.5px] font-bold leading-[normal] text-t2">
      {children}
      {required ? <em className="text-red">*</em> : null}
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

export function HqAccountModal({ mode, account, onClose }: HqAccountModalProps) {
  const confirm = useConfirm();
  const createAccount = useCreatePlatformHqAccount();
  const updateAccount = useUpdatePlatformHqAccount();
  const deleteAccount = useDeletePlatformHqAccount();
  const resetPassword = usePlatformResetPassword();
  const [values, setValues] = useState<FormValues>(() => initialValues(mode, account));
  const [invalid, setInvalid] = useState<Partial<Record<InvalidField, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);

  const requestPending = createAccount.isPending
    || updateAccount.isPending
    || deleteAccount.isPending
    || resetPassword.isPending;

  const setField = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (field === "fullName" || field === "hqRole" || field === "phone" || field === "username" || field === "password") {
      const invalidField = field as InvalidField;
      setInvalid((current) => {
        if (!current[invalidField]) return current;
        const next = { ...current };
        delete next[invalidField];
        return next;
      });
    }
  };

  const validate = () => {
    const nextInvalid: Partial<Record<InvalidField, boolean>> = {};
    const missing: string[] = [];
    const fullName = values.fullName.trim();
    const username = values.username.trim();
    const phone = values.phone.trim();

    if (!fullName) {
      nextInvalid.fullName = true;
      missing.push("이름");
    }
    if (!values.hqRole) {
      nextInvalid.hqRole = true;
      missing.push("역할");
    }
    if (!PHONE_PATTERN.test(phone)) {
      nextInvalid.phone = true;
      missing.push("전화번호");
    }
    if (mode === "create" && !username) {
      nextInvalid.username = true;
      missing.push("아이디");
    }
    if ((mode === "create" && !PASSWORD_PATTERN.test(values.password)) || (mode === "edit" && values.password && !PASSWORD_PATTERN.test(values.password))) {
      nextInvalid.password = true;
      missing.push("비밀번호(4자리)");
    }

    if (missing.length > 0) {
      setInvalid(nextInvalid);
      setError(`${missing.join(", ")}을(를) 확인해 주세요`);
      return null;
    }

    setInvalid({});
    setError(null);
    return {
      fullName,
      username,
      phone,
      hqRole: values.hqRole as HqRole,
      password: values.password,
      memo: values.memo.trim(),
      isActive: values.isActive,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestPending) return;
    const prepared = validate();
    if (!prepared) return;

    setConfirmPending(true);
    try {
      const accepted = await confirm({
        title: mode === "create" ? "계정을 생성할까요?" : "변경 사항을 저장할까요?",
        description: mode === "create" ? (
          <><b className="font-bold text-t1">{prepared.fullName}</b> 계정이 발급되어 바로 로그인할 수 있습니다.</>
        ) : (
          <><b className="font-bold text-t1">{prepared.fullName}</b> 계정 정보가 수정됩니다.</>
        ),
        confirmLabel: mode === "create" ? "생성" : "저장",
        look: "hqCompact",
      });
      if (!accepted) return;

      if (mode === "create") {
        await createAccount.mutateAsync({
          username: prepared.username,
          password: prepared.password,
          fullName: prepared.fullName,
          phone: prepared.phone,
          memo: prepared.memo || null,
          hqRole: prepared.hqRole,
        });
        toast.success(`${prepared.fullName} 계정을 생성했어요`);
      } else if (account) {
        await updateAccount.mutateAsync({
          userId: account.userId,
          fullName: prepared.fullName,
          phone: prepared.phone,
          memo: prepared.memo || null,
          hqRole: prepared.hqRole,
          isActive: prepared.isActive,
        });
        if (prepared.password) {
          await resetPassword.mutateAsync({ userId: account.userId, password: prepared.password });
        }
        toast.success(`${prepared.fullName} 계정을 저장했어요`);
      }
      onClose();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setConfirmPending(false);
    }
  };

  const handleDelete = async () => {
    if (!account || requestPending) return;
    setConfirmPending(true);
    try {
      const accepted = await confirm({
        title: "계정을 삭제할까요?",
        description: (
          <>
            <b className="font-bold text-t1">{account.fullName}</b> 계정이 삭제되고 즉시 로그인할 수 없게 됩니다.
            <br />
            <span className="font-bold text-red">되돌릴 수 없습니다.</span>
          </>
        ),
        confirmLabel: "삭제",
        variant: "danger",
        look: "hqCompact",
      });
      if (!accepted) return;
      await deleteAccount.mutateAsync(account.userId);
      toast.success("계정을 삭제했어요");
      onClose();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setConfirmPending(false);
    }
  };

  const title = mode === "create" ? "본사 계정 추가" : account?.fullName ?? "본사 계정";
  const description = mode === "create"
    ? "생성하면 입력한 아이디로 콘솔에 로그인할 수 있어요."
    : "계정 정보를 수정합니다. 비밀번호는 입력할 때만 변경돼요.";

  return (
    <Modal
      open
      onClose={() => {
        if (!requestPending && !confirmPending) onClose();
      }}
      title={title}
      className="flex max-h-[88vh] max-w-[min(480px,90vw)] flex-col rounded-[20px] px-0 pb-0 pt-[22px] leading-[normal] shadow-hf-modal [&>h2]:px-6 [&>h2]:text-[17px] [&>h2]:font-extrabold [&>h2]:leading-[normal] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      <p className="mt-[6px] px-6 pb-1 text-[13px] font-medium leading-[normal] text-t3">
        {description}
      </p>
      <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void handleSubmit(event)}>
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-1 pt-[18px]">
          <div className="grid grid-cols-2 gap-x-[15px] gap-y-[13px]">
            {mode === "edit" && (
              <div className="col-span-2">
                <FieldLabel>상태</FieldLabel>
                <SegmentedControl
                  variant="hq"
                  options={[
                    { value: "active", label: "활성" },
                    { value: "inactive", label: "정지" },
                  ]}
                  value={values.isActive ? "active" : "inactive"}
                  onChange={(value) => setField("isActive", value === "active")}
                />
              </div>
            )}

            <div>
              <FieldLabel required>이름</FieldLabel>
              <Input
                id="aName"
                size="42"
                value={values.fullName}
                placeholder="최본사"
                className={invalid.fullName ? "border-red!" : ""}
                onChange={(event) => setField("fullName", event.currentTarget.value)}
              />
            </div>
            <div>
              <FieldLabel required>역할</FieldLabel>
              <div className={invalid.hqRole ? `${ADMIN_FORM_DROPDOWN_CLASS} [&_.uc-dd-btn]:border-red!` : ADMIN_FORM_DROPDOWN_CLASS}>
                <CustomDropdown
                  ariaLabel="역할"
                  value={values.hqRole}
                  options={HQ_ROLE_OPTIONS}
                  placeholder="선택"
                  onChange={(value) => setField("hqRole", value as HqRole)}
                  position="fixed"
                  menuMinWidth={0}
                  menuOffset={6}
                  menuClassName={ADMIN_DROPDOWN_MENU_CLASS}
                  chevron="rotate"
                  chevronMs={180}
                />
              </div>
            </div>

            <div className="col-span-2">
              <FieldLabel required>전화번호</FieldLabel>
              <PhoneInput
                id="aTel"
                size="42"
                value={values.phone}
                placeholder="010-0000-0000"
                maxLength={13}
                className={invalid.phone ? "num border-red!" : "num"}
                onChange={(event) => setField("phone", event.currentTarget.value)}
              />
            </div>

            <div className="col-span-2 my-[3px] h-px bg-line2" />

            <div>
              <FieldLabel required>아이디</FieldLabel>
              <Input
                id="aId"
                size="42"
                value={values.username}
                placeholder="hq_master"
                disabled={mode === "edit"}
                className={mode === "edit" ? "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-bg disabled:text-t3 disabled:opacity-100" : invalid.username ? "border-red!" : ""}
                onChange={(event) => setField("username", event.currentTarget.value)}
              />
            </div>
            <div>
              <FieldLabel required={mode === "create"}>{mode === "create" ? "비밀번호" : "비밀번호 변경"}</FieldLabel>
              <HqPasswordInput
                key={`${mode}:${account?.userId ?? "create"}`}
                id="aPw"
                size="42"
                variant="plain"
                value={values.password}
                placeholder="4자리"
                maxLength={4}
                inputMode="numeric"
                autoComplete="new-password"
                className={invalid.password ? "num border-red!" : "num"}
                onChange={(event) => setField("password", event.currentTarget.value.replace(/\D/g, "").slice(0, 4))}
              />
            </div>

            <div className="col-span-2">
              <FieldLabel>메모</FieldLabel>
              <Input
                id="aMemo"
                size="42"
                value={values.memo}
                placeholder="담당 업무 · 비고"
                maxLength={500}
                onChange={(event) => setField("memo", event.currentTarget.value)}
              />
            </div>
          </div>

          {error ? (
            <div className="mt-3 rounded-[11px] border border-[rgba(233,79,79,0.22)] bg-[rgba(233,79,79,0.07)] px-[14px] py-[11px] text-[12.5px] font-bold leading-[normal] text-red" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 border-t border-line2 px-6 pb-5 pt-4">
          {mode === "edit" ? (
            <Button type="button" size="std" variant="danger" className="border border-transparent shadow-none" onClick={() => void handleDelete()} disabled={requestPending}>
              삭제
            </Button>
          ) : null}
          <div className="flex-1" />
          <Button type="button" size="std" variant="ghost" onClick={onClose} disabled={requestPending}>
            취소
          </Button>
          <Button type="submit" size="std" variant="primary" className="border border-transparent" disabled={requestPending}>
            {mode === "create" ? "생성" : "저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
