"use client";

/**
 * 자체 62px 헤더를 그리는 화면(`AppShell.hasIntegratedHeader`)용 공용 헤더.
 *
 * 규격은 `Topbar`와 동일하다 — Figma 노드 `72:69556` 실측 결과 셋업 설정 헤더가
 * `Topbar`와 픽셀 단위로 같고 우측 액션만 다르다. 제목을 nav 라벨이 아니라 화면이
 * 직접 정하고 우측에 액션을 두려는 화면이 이 컴포넌트를 쓴다.
 *
 * `notices`·`buildings`·`buildings/new-v2`는 같은 마크업을 손으로 복제해 두고 있다
 * (`NoticesWorkspace`는 한 파일에서 두 번). 그쪽 이관은 별건으로 남긴다.
 */
export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex h-[62px] flex-none items-center gap-[12px] border-b border-line bg-white px-6">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("app-shell:toggle-sidebar"))}
        className="mr-[2px] flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] text-t2 transition-colors hover:bg-bg"
        aria-label="메뉴 열기"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[20px] w-[20px]"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h1 className="text-[19px] font-extrabold tracking-[-0.38px] text-t1 whitespace-nowrap">
        {title}
      </h1>

      <div className="flex-1" />

      {actions}
    </header>
  );
}
