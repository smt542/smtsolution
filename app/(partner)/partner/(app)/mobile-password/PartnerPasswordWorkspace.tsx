"use client";

import { useRouter } from "next/navigation";
import { PasswordChangeForm } from "@/components/auth/PasswordChangeForm";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { PartnerButton } from "../../../_components/PartnerButton";
import { PartnerMobileHeader } from "../../../_components/PartnerMobileHeader";

const PROFILE_HREF = "/partner/mobile-profile";

export function PartnerPasswordWorkspace() {
  const router = useRouter();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white leading-[normal]">
      <PartnerMobileHeader title="비밀번호 변경" backHref={PROFILE_HREF} />
      <div className="min-h-0 flex-1 overflow-auto px-5 pb-6 pt-2">
        <PasswordChangeForm
          variant="partner"
          labels={{ password: "비밀번호 변경", confirm: "비밀번호 변경 확인" }}
          submitLabel="변경하기"
          onSuccess={() => {
            toast.success("비밀번호를 변경했어요");
            router.replace(PROFILE_HREF);
          }}
          renderSubmit={({ disabled, label }) => (
            <PartnerButton variant="primary" type="submit" className="w-full" disabled={disabled}>
              {label}
            </PartnerButton>
          )}
        />
      </div>
    </div>
  );
}
