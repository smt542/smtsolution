"use client";

const DEFAULT_ERROR_MESSAGE = "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요";

const TOAST_VISIBLE_MS = 1800;
const TOAST_FADE_OUT_MS = 300;

export class AppError extends Error {
  constructor(public readonly userMessage: string, options?: ErrorOptions) {
    super(userMessage, options);
    this.name = "AppError";
  }
}

export function toUserMessage(
  error: unknown,
  fallback = DEFAULT_ERROR_MESSAGE,
): string {
  if (error instanceof AppError && error.userMessage.trim()) return error.userMessage;
  return fallback.trim() || DEFAULT_ERROR_MESSAGE;
}

export type AppToastId = string | number;

export interface AppToastOptions {
  id?: AppToastId;
}

interface ToastRecord {
  element: HTMLDivElement;
  animationFrameId?: number;
  dismissTimer?: ReturnType<typeof setTimeout>;
  fadeTimer?: ReturnType<typeof setTimeout>;
}

const activeToasts = new Map<AppToastId, ToastRecord>();
let nextToastId = 0;

function createToastId(): AppToastId {
  let id = ++nextToastId;
  while (activeToasts.has(id)) id = ++nextToastId;
  return id;
}

function clearToastTimers(record: ToastRecord) {
  if (record.animationFrameId !== undefined) {
    cancelAnimationFrame(record.animationFrameId);
    record.animationFrameId = undefined;
  }
  if (record.dismissTimer !== undefined) {
    clearTimeout(record.dismissTimer);
    record.dismissTimer = undefined;
  }
  if (record.fadeTimer !== undefined) {
    clearTimeout(record.fadeTimer);
    record.fadeTimer = undefined;
  }
}

function removeToast(id: AppToastId, record: ToastRecord) {
  if (activeToasts.get(id) !== record) return;
  clearToastTimers(record);
  activeToasts.delete(id);
  record.element.remove();
}

function fadeOutToast(id: AppToastId, record: ToastRecord) {
  if (activeToasts.get(id) !== record) return;
  clearToastTimers(record);
  record.element.classList.remove("show");
  record.fadeTimer = setTimeout(() => removeToast(id, record), TOAST_FADE_OUT_MS);
}

function scheduleToastDismissal(id: AppToastId, record: ToastRecord) {
  record.dismissTimer = setTimeout(
    () => fadeOutToast(id, record),
    TOAST_VISIBLE_MS,
  );
}

function showToast(message: string, options?: AppToastOptions): AppToastId {
  const id = options?.id ?? createToastId();
  if (typeof document === "undefined") return id;

  // 같은 id면 새로 쌓지 않고 기존 토스트의 문구·타이머만 갱신한다.
  // add는 멱등이라 사라지는 중이던(show가 벗겨진) 토스트도 깜빡임 없이 되살아난다.
  const existing = activeToasts.get(id);
  if (existing) {
    clearToastTimers(existing);
    existing.element.textContent = message;
    existing.element.classList.add("show");
    scheduleToastDismissal(id, existing);
    return id;
  }

  const element = document.createElement("div");
  element.className = "erp-toast";
  element.setAttribute("role", "status");
  // 라이브 리전은 DOM에 먼저 붙인 뒤 내용을 채워야 스크린리더가 안정적으로 읽는다.
  document.body.appendChild(element);
  element.textContent = message;

  const record: ToastRecord = { element };
  activeToasts.set(id, record);
  record.animationFrameId = requestAnimationFrame(() => {
    if (activeToasts.get(id) !== record) return;
    record.animationFrameId = undefined;
    element.classList.add("show");
  });
  scheduleToastDismissal(id, record);
  return id;
}

type AppToastMessage = (message: string, options?: AppToastOptions) => AppToastId;

interface AppToastError {
  (message: string, options?: AppToastOptions): AppToastId;
  (error: unknown, fallback: string, options?: AppToastOptions): AppToastId;
}

const showError: AppToastError = (
  value: unknown,
  fallbackOrOptions?: string | AppToastOptions,
  options?: AppToastOptions,
) => {
  if (typeof fallbackOrOptions === "string") {
    return showToast(toUserMessage(value, fallbackOrOptions), options);
  }

  const message = typeof value === "string" ? value : toUserMessage(value);
  return showToast(message, fallbackOrOptions);
};

// 모양은 정본 .erp-toast 하나뿐이고, 메서드는 문구 유형을 구분한다.
// 문구는 해요체로 쓰고 끝에 마침표를 붙이지 않는다.
//   success  완료: {대상}을 {동작}했어요
//   warning  입력 누락: {항목}을 입력해/선택해 주세요
//            대상 없음: {동작}할 {대상}이 없어요
//            제한 안내: 유형은 최대 6개까지예요
//   info     진행 중: ~하고 있어요
//            상태 전환·기타: 전체 기간으로 조회했어요
//   error    실패: ~하지 못했어요 / ~에 실패했어요
// 입력 누락·대상 없음·제한 안내를 error로 띄우지 않는다. 유형별 스타일이 생기면 실패처럼 보인다.
export interface AppToast {
  success: AppToastMessage;
  info: AppToastMessage;
  warning: AppToastMessage;
  error: AppToastError;
}

export const appToast: AppToast = {
  success: (message, options) => showToast(message, options),
  info: (message, options) => showToast(message, options),
  warning: (message, options) => showToast(message, options),
  error: showError,
};

export function useAppToast() {
  return appToast;
}
