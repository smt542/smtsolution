const UNCONFIRMED = "미확정";

function nonEmpty(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

/** 원 단위 숫자를 통화 기호·단위 없는 천 단위 문자열로 만든다. */
export function formatKrw(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return UNCONFIRMED;
  }
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(
    value,
  );
}

/** YYYY-MM 또는 ISO 날짜를 `YYYY년 M월` 형식으로 만든다. */
export function formatPeriodMonth(value: string | null | undefined): string {
  const normalized = nonEmpty(value);
  const match = normalized?.match(/^(\d{4})-(\d{1,2})(?:-|$)/);
  if (!match) return UNCONFIRMED;

  const month = Number(match[2]);
  if (month < 1 || month > 12) return UNCONFIRMED;
  return `${match[1]}년 ${month}월`;
}

/** ISO 날짜 또는 일시에서 유효한 YYYY-MM-DD 날짜만 반환한다. */
export function formatDate(value: string | null | undefined): string {
  const normalized = nonEmpty(value);
  const match = normalized?.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match) return UNCONFIRMED;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return UNCONFIRMED;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** 동·호 번호를 알림톡의 세대 표기 형식으로 조합한다. */
export function formatUnit(
  dong: string | null | undefined,
  unitNo: string | null | undefined,
): string {
  const normalizedDong = nonEmpty(dong);
  const normalizedUnitNo = nonEmpty(unitNo);
  const parts = [
    normalizedDong
      ? normalizedDong.endsWith("동")
        ? normalizedDong
        : `${normalizedDong}동`
      : null,
    normalizedUnitNo
      ? normalizedUnitNo.endsWith("호")
        ? normalizedUnitNo
        : `${normalizedUnitNo}호`
      : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(" ") : UNCONFIRMED;
}

/** 은행명과 계좌번호를 공백으로 조합한다. */
export function formatAccount(
  bank: string | null | undefined,
  account: string | null | undefined,
): string {
  const parts = [nonEmpty(bank), nonEmpty(account)].filter(
    (part): part is string => part !== null,
  );
  return parts.length > 0 ? parts.join(" ") : UNCONFIRMED;
}
