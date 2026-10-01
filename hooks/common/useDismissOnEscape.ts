import { useEffect } from "react";

interface UseDismissOnEscapeOptions {
  enabled: boolean;
  onDismiss: () => void;
  disabled?: boolean;
  lockBodyScroll?: boolean;
}

/**
 * 모달·다이얼로그의 Escape 닫기 동작만 공통화한다.
 * 시각 구조와 overlay 클릭 처리는 각 화면이 그대로 소유한다.
 */
export function useDismissOnEscape({
  enabled,
  onDismiss,
  disabled = false,
  lockBodyScroll = false,
}: UseDismissOnEscapeOptions) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !disabled) onDismiss();
    };

    document.addEventListener("keydown", onKeyDown);
    if (lockBodyScroll) document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (lockBodyScroll) document.body.style.overflow = "";
    };
  }, [disabled, enabled, lockBodyScroll, onDismiss]);
}
