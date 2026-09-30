export type ResidentToastOffset = "page" | "nav";

const toastBaseClass =
  "fixed left-1/2 z-[90] -translate-x-1/2 whitespace-nowrap rounded-[13px] bg-[#191F28] px-5 py-[13px] text-[14px] font-bold leading-[normal] text-white";
const toastOffsetClass: Record<ResidentToastOffset, string> = {
  page: "bottom-[56px]",
  nav: "bottom-[96px]",
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;

// 세입자 앱 공용 토스트(정본 .toast). div 하나를 재사용해 1.6초 보인 뒤 숨긴다(쌓지 않음).
// offset: page = 하단 탭 없는 화면(bottom 56px), nav = 하단 탭 있는 화면(bottom 96px).
export function showResidentToast(
  message: string,
  offset: ResidentToastOffset = "page",
): void {
  if (typeof document === "undefined") return;

  let toast = document.getElementById("resident-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "resident-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.className = `${toastBaseClass} ${toastOffsetClass[offset]}`;
    toast.style.display = "none";
    document.body.appendChild(toast);
  } else {
    toast.classList.remove("bottom-[56px]", "bottom-[96px]");
    toast.classList.add(toastOffsetClass[offset]);
  }

  toast.textContent = message;
  toast.style.display = "block";
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast!.style.display = "none";
    toastTimer = null;
  }, 1600);
}
