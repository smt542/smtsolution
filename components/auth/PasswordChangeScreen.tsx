"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useLogout } from "@/hooks/reactquery/auth";
import { PasswordChangeForm } from "./PasswordChangeForm";

/**
 * 최초 로그인(임시 비밀번호) 강제 변경 화면. 변경을 마쳐야 서비스에 들어갈 수 있고,
 * 건너뛰기는 없다 — 나가려면 로그아웃만 가능하다.
 */
export function PasswordChangeScreen({
  homePath,
  loginPath,
}: {
  homePath: string;
  loginPath: string;
}) {
  const router = useRouter();
  const logout = useLogout();

  const handleLogout = async () => {
    await logout.mutateAsync().catch(() => undefined);
    router.replace(loginPath);
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5 py-12">
      <main className="w-full max-w-[420px] rounded-[22px] bg-surface px-7 pb-8 pt-9 shadow-card sm:px-9">
        <div className="mb-[26px]">
          <div className="mb-5 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-blue-t">
            <Image src="/logo-mark.png" alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" priority />
          </div>
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-t1">비밀번호 변경</h1>
          <p className="mt-1.5 text-[13.5px] font-medium leading-[1.6] text-t3">
            처음 발급받은 비밀번호는 임시 비밀번호예요.<br />
            새 비밀번호로 변경해야 서비스를 이용할 수 있어요.
          </p>
        </div>
        <PasswordChangeForm
          submitLabel="변경하고 시작하기"
          onSuccess={() => {
            toast.success("비밀번호를 변경했어요");
            router.replace(homePath);
            router.refresh();
          }}
        />
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={logout.isPending}
          className="mt-4 w-full text-center text-[13px] font-semibold text-t3 underline-offset-2 hover:text-t2 hover:underline disabled:opacity-60"
        >
          다른 계정으로 로그인
        </button>
      </main>
    </div>
  );
}
