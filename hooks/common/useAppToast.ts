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
  if (error instanceof AppError && error.userMessage.trim()) return error.userMessage;
  return fallback.trim() || DEFAULT_ERROR_MESSAGE;
}

export type AppToastId = string | number;

export interface AppToastOptions {
  id?: AppToastId;
}

type AppToastMessage = (message: string, options?: AppToastOptions) => AppToastId;

interface AppToastError {
  (message: string, options?: AppToastOptions): AppToastId;
  (error: unknown, fallback: string, options?: AppToastOptions): AppToastId;
}

function showMessage(
  method: (message: string, options?: AppToastOptions) => AppToastId,
  message: string,
  options?: AppToastOptions,
) {
  return options ? method(message, options) : method(message);
}

const showError: AppToastError = (
  value: unknown,
  fallbackOrOptions?: string | AppToastOptions,
  options?: AppToastOptions,
) => {
  if (typeof fallbackOrOptions === "string") {
    return showMessage(toast.error, toUserMessage(value, fallbackOrOptions), options);
  }

  const message = typeof value === "string" ? value : toUserMessage(value);
  return showMessage(toast.error, message, fallbackOrOptions);
};

export interface AppToast {
  success: AppToastMessage;
  info: AppToastMessage;
  warning: AppToastMessage;
  error: AppToastError;
  loading: (message: string) => AppToastId;
  dismiss: (id?: AppToastId) => void;
}

export const appToast: AppToast = {
  success: (message, options) => showMessage(toast.success, message, options),
  info: (message, options) => showMessage(toast.info, message, options),
  warning: (message, options) => showMessage(toast.warning, message, options),
  error: showError,
  loading: (message) => toast.loading(message),
  dismiss: (id) => toast.dismiss(id),
};

export function useAppToast() {
  return appToast;
}
