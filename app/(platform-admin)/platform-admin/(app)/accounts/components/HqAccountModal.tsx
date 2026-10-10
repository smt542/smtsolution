"use client";

import { PASSWORD_MAX_LENGTH, PASSWORD_RULE_TEXT } from "@/lib/auth/passwordPolicy";
import { hqAccountCreateSchema, hqAccountEditSchema } from "@/components/forms/schema/hqAccount";
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
  passwordConfirm: string;
  memo: string;
  isActive: boolean;
};

type InvalidField = "fullName" | "hqRole" | "phone" | "username" | "password" | "passwordConfirm";

const INVALID_FIELDS: readonly InvalidField[] = ["fullName", "hqRole", "phone", "username", "password", "passwordConfirm"];
const FIELD_LABELS: Record<InvalidField, string> = {
  fullName: "이름",
  hqRole: "역할",
  phone: "전화번호",
  username: "아이디",
  password: `비밀번호(${PASSWORD_RULE_TEXT})`,
  passwordConfirm: "비밀번호 확인",
};
/** 기본 본사 관리자 계정 — 정지할 수 없다(DB 트리거 0280도 막는다). */
const PROTECTED_USERNAME = "hqadmin";
const isMaskedPhone = (value: string | null | undefined) => Boolean(value && value.includes("*"));
const MASKED_PHONE_ERROR = "전화번호가 가려진 상태라 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.";

function initialValues(mode: HqAccountModalProps["mode"], account?: PlatformHqAccount): FormValues {
  if (mode === "edit" && account) {
    return {
      fullName: account.fullName,
      hqRole: account.hqRole ?? "",
      phone: account.phone,
      username: account.username,
      password: "",
      passwordConfirm: "",
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
    passwordConfirm: "",
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
  const [passwordConfirmError, setPasswordConfirmError] = useState<string | null>(null);
  const isProtectedAccount = mode === "edit" && account?.username.toLowerCase() === PROTECTED_USERNAME;
  const [confirmPending, setConfirmPending] = useState(false);

  const requestPending = createAccount.isPending
    || updateAccount.isPending
    || deleteAccount.isPending
    || resetPassword.isPending;

  const setField = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    if ((INVALID_FIELDS as readonly string[]).includes(field)) {
      // 비밀번호를 고치면 확인 칸 불일치 표시도 다시 판단하게 함께 지운다.
      const cleared: InvalidField[] = field === "password" ? ["password", "passwordConfirm"] : [field as InvalidField];
      setInvalid((current) => {
        if (!cleared.some((name) => current[name])) return current;
        const next = { ...current };
        for (const name of cleared) delete next[name];
        return next;
      });
      setPasswordConfirmError(null);
    }
  };

  // zod 스키마(hqAccountCreateSchema·hqAccountEditSchema)로 검증하고, 틀린 칸을 빨갛게 표시한다.
  const validate = () => {
    const schema = mode === "create" ? hqAccountCreateSchema : hqAccountEditSchema;
    const result = schema.safeParse(values);
    if (!result.success) {
      const nextInvalid: Partial<Record<InvalidField, boolean>> = {};
      let confirmMessage: string | null = null;
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && (INVALID_FIELDS as readonly string[]).includes(field)) {
          nextInvalid[field as InvalidField] = true;
          if (field === "passwordConfirm") confirmMessage ??= issue.message;
        }
      }
      setInvalid(nextInvalid);
      setPasswordConfirmError(confirmMessage);
      const otherInvalid = INVALID_FIELDS.filter((name) => name !== "passwordConfirm" && nextInvalid[name]);
      setError(otherInvalid.length > 0
        ? `${otherInvalid.map((name) => FIELD_LABELS[name]).join(", ")}을(를) 확인해 주세요`
        : confirmMessage);
      return null;
    }

    setInvalid({});
    setError(null);
    setPasswordConfirmError(null);
    const data = result.data;
    return {
      fullName: data.fullName,
      username: data.username.trim(),
      phone: data.phone,
      hqRole: data.hqRole,
      password: data.password,
      memo: data.memo,
      isActive: data.isActive,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestPending) return;
    if (mode === "edit" && isMaskedPhone(values.phone)) {
      setError(MASKED_PHONE_ERROR);
      return;
    }
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
                  disabled={isProtectedAccount && values.isActive}
                />
                {isProtectedAccount ? (
                  <p className="mt-1.5 text-[12px] font-medium leading-[normal] text-t3">
                    기본 본사 관리자 계정은 정지할 수 없어요.
                  </p>
                ) : null}
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

            <div className="col-span-2">
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
                placeholder={mode === "create" ? PASSWORD_RULE_TEXT : `변경할 때만 (${PASSWORD_RULE_TEXT})`}
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                className={invalid.password ? "border-red!" : ""}
                onChange={(event) => setField("password", event.currentTarget.value)}
              />
            </div>
            <div>
              <FieldLabel required={mode === "create"}>{mode === "create" ? "비밀번호 확인" : "비밀번호 변경 확인"}</FieldLabel>
              <HqPasswordInput
                key={`${mode}:${account?.userId ?? "create"}:confirm`}
                id="aPwConfirm"
                size="42"
                variant="plain"
                value={values.passwordConfirm}
                placeholder="비밀번호를 한 번 더 입력"
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                className={invalid.passwordConfirm ? "border-red!" : ""}
                aria-invalid={invalid.passwordConfirm || undefined}
                onChange={(event) => setField("passwordConfirm", event.currentTarget.value)}
              />
              {passwordConfirmError ? (
                <p className="mt-1.5 text-[12px] font-semibold leading-[normal] text-red">{passwordConfirmError}</p>
              ) : null}
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
