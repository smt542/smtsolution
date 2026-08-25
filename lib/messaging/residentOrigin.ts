const RESIDENT_WEB_ORIGIN_ENV = "NEXT_PUBLIC_RESIDENT_WEB_ORIGIN";

export function residentOrigin(): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_RESIDENT_WEB_ORIGIN?.trim();

  if (!configuredOrigin) {
    throw new Error(`${RESIDENT_WEB_ORIGIN_ENV} is not configured`);
  }

  return configuredOrigin.replace(/\/+$/, "");
}
