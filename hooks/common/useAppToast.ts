"use client";

import { toast } from "sonner";

const DEFAULT_ERROR_MESSAGE = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

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
  if (error instanceof AppError) return error.userMessage;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export const appToast = {
  success: (message: string) => toast.success(message),
  info: (message: string) => toast.info(message),
  warning: (message: string) => toast.warning(message),
  error: (error: unknown, fallback?: string) => toast.error(toUserMessage(error, fallback)),
  loading: (message: string) => toast.loading(message),
  dismiss: (id?: string | number) => toast.dismiss(id),
};

export function useAppToast() {
  return appToast;
}
