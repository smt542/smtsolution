import Image from "next/image";

import { mobileHeaderClass, type MobileBackHeaderVariant } from "./MobileBackHeader";

/**
 * 비로그인 공개 링크(`/share/*`) 상단바. 정본 `.guest`는 로그인 화면과 같은 상단바에서
 * 뒤로가기·제목을 숨기고 관리비서 로고(`.brand`)만 보인다 — 공지 상세 `.hdr` = detail, 관리비 상세 `.top` = bar.
 */
export default function ResidentGuestHeader({
  variant,
}: {
  variant: Exclude<MobileBackHeaderVariant, "list">;
}) {
  return (
    <header className={mobileHeaderClass[variant]}>
      <span className="flex items-center gap-[7px] pl-2">
        <Image className="block size-[22px] object-contain" src="/logo-mark.png" alt="" width={22} height={22} />
        <b className="text-[15px] font-extrabold tracking-[-0.02em] text-[#16375a]">
          관리<em className="not-italic text-blue">비서</em>
        </b>
      </span>
    </header>
  );
}
