import { z } from "zod";

export const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const emptyStringToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export function requiredInteger(message: string) {
  return z.preprocess(
    emptyStringToUndefined,
    z.coerce.number({ invalid_type_error: message, required_error: message }).int(message),
  );
}

export function optionalInteger(message: string) {
  return z.preprocess(
    emptyStringToUndefined,
    z.coerce.number({ invalid_type_error: message }).int(message).optional(),
  );
}

export function nullableInteger(message: string) {
  return z.preprocess(
    emptyStringToNull,
    z.union([z.null(), z.coerce.number({ invalid_type_error: message }).int(message)]),
  );
}

export function optionalTrimmedString(max: number, message: string) {
  return z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(max, message).optional(),
  );
}

export function nullableTrimmedString(max: number, message: string) {
  return z.preprocess(
    emptyStringToNull,
    z.union([z.null(), z.string().trim().max(max, message)]),
  );
}

function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function requiredDate(message: string) {
  return z.string().trim().refine(isRealDate, message);
}

export function nullableDate(message: string) {
  return z.string().trim().refine((value) => value === "" || isRealDate(value), message)
    .transform((value) => value || null);
}

export function nullableDateTime(message: string) {
  return z.string().trim()
    .refine((value) => value === "" || Number.isFinite(new Date(value).getTime()), message)
    .transform((value) => value ? new Date(value).toISOString() : null);
}
