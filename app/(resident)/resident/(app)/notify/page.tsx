import NotificationSwitch, { NotifyChoiceProvider } from "./NotificationSwitch";
import NotifyNavigationButton from "./NotifyNavigationButton";
import NotifyStartButton from "./NotifyStartButton";
import { notifyClasses } from "./notifyClasses";

export default function ResidentNotifyPage() {
  return (
    <NotifyChoiceProvider>
      <div className="flex flex-none items-center px-3 pb-1 pt-[calc(env(safe-area-inset-top)+12px)]">
        <NotifyNavigationButton
          href="/resident/verify"
          className="flex size-[38px] items-center justify-center rounded-xl bg-transparent text-t2 hover:bg-bg [&_svg]:size-[22px]"
          ariaLabel="이전 화면"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </NotifyNavigationButton>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-7 pb-2 pt-2.5">
        <h1 className="mt-2 text-[24px] font-extrabold leading-[1.38] tracking-[-0.03em] animate-[rise_0.5s_cubic-bezier(0.22,0.61,0.36,1)_both]">알림을 받아보세요</h1>
        <p className="mt-2.5 text-[14.5px] font-semibold leading-[1.62] text-t3 animate-[rise_0.5s_60ms_cubic-bezier(0.22,0.61,0.36,1)_both]">
          관리비가 확정되거나 건물 공지가 올라오면
          <br />
          카카오톡으로 바로 알려드려요.
        </p>

        <div className={notifyClasses.items}>
          <div className={notifyClasses.item}>
            <div className={notifyClasses.icon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 5h10l4 4v10H5z" />
                <path d="M8 12h8M8 16h5" />
              </svg>
            </div>
            <div className={notifyClasses.text}>
              <b>알림톡 받기</b>
              <span>관리비 발행과 건물 공지를 알려드려요</span>
            </div>
            <NotificationSwitch />
          </div>
        </div>
        <div className={notifyClasses.note}>
          알림은 언제든 내 정보에서 다시 끄고 켤 수 있어요.
        </div>
      </div>

      <div className="flex flex-none flex-col gap-2.5 px-7 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3.5">
        <NotifyStartButton
          href="/resident/home"
          className={notifyClasses.primaryButton}
        >
          시작하기
        </NotifyStartButton>
      </div>
    </NotifyChoiceProvider>
  );
}
