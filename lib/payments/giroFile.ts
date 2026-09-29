export type GiroFileErrorCode = "read-failed" | "format" | "checksum" | "customer-no";

const ERROR_MESSAGES: Record<GiroFileErrorCode, string> = {
  "read-failed": "파일을 읽지 못했어요",
  format: "지로 수납 파일 형식이 아니에요",
  checksum: "합계가 맞지 않는 지로 수납 파일이에요",
  "customer-no": "고객조회번호를 확인할 수 없어요",
};

export class GiroFileError extends Error {
  public readonly code: GiroFileErrorCode;

  constructor(code: GiroFileErrorCode, message = ERROR_MESSAGES[code], options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = "GiroFileError";
  }
}

export interface GiroRecord {
  rowIndex: number;
  seq: string;
  paidAt: string;
  depositedAt: string;
  txNo: string;
  customerNo: string;
  buildingCode: string;
  roomNo: string;
  period: string;
  amount: number;
  fee: number;
  channel: string;
  externalRef: string;
}

export interface GiroFile {
  giroNo: string;
  depositedAt: string;
  records: GiroRecord[];
  totalAmount: number;
  totalFee: number;
}

const RECORD_BYTES = 120;

function formatError(): never {
  throw new GiroFileError("format");
}

function checksumError(): never {
  throw new GiroFileError("checksum");
}

function customerNoError(line: number): never {
  throw new GiroFileError("customer-no", `${line}번째 줄 고객조회번호를 확인할 수 없어요`);
}

function isAsciiDigit(byte: number): boolean {
  return byte >= 0x30 && byte <= 0x39;
}

function field(record: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...record.slice(start, start + length));
}

function digits(record: Uint8Array, start: number, length: number): string {
  const value = field(record, start, length);
  for (const byte of record.slice(start, start + length)) {
    if (!isAsciiDigit(byte)) formatError();
  }
  return value;
}

function dateValue(value: string): string {
  if (!/^\d{8}$/.test(value)) formatError();
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (year < 1 || month < 1 || month > 12 || day < 1) formatError();
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > daysInMonth) formatError();
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function periodValue(customerNo: string, line: number): { buildingCode: string; roomNo: string; period: string } {
  if (customerNo.slice(0, 6) !== "000000") customerNoError(line);
  const buildingCode = customerNo.slice(6, 9);
  const roomNo = customerNo.slice(9, 13);
  const year = customerNo.slice(13, 17);
  const month = customerNo.slice(17, 19);
  if (Number(year) < 1 || Number(month) < 1 || Number(month) > 12) customerNoError(line);

  let sum = 0;
  let double = true;
  for (let index = 18; index >= 0; index -= 1) {
    let value = Number(customerNo[index]);
    if (double) {
      value *= 2;
      if (value >= 10) value = Math.floor(value / 10) + (value % 10);
    }
    sum += value;
    double = !double;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  if (checkDigit !== Number(customerNo[19])) customerNoError(line);

  return { buildingCode, roomNo, period: `${year}-${month}-01` };
}

function numericValue(value: string): number {
  return Number(value);
}

function splitRecords(bytes: Uint8Array): Uint8Array[] {
  // 끝의 줄바꿈·빈 줄은 레코드 구조와 무관하니 떼고 본다(레코드 끝 칸은 공백이라 레코드를 깎지 않는다).
  let length = bytes.length;
  while (length > 0 && (bytes[length - 1] === 0x0a || bytes[length - 1] === 0x0d)) length -= 1;
  if (length === 0) formatError();
  const body = bytes.subarray(0, length);

  const records: Uint8Array[] = [];
  let start = 0;
  let hasLineFeed = false;
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== 0x0a) continue;
    hasLineFeed = true;
    let end = index;
    if (end > start && body[end - 1] === 0x0d) end -= 1;
    if (end - start !== RECORD_BYTES) formatError();
    records.push(body.slice(start, end));
    start = index + 1;
  }

  // 줄바꿈 없이 이어 붙인 스트림 형태면 120바이트씩 자른다.
  if (!hasLineFeed) {
    if (body.length % RECORD_BYTES !== 0) formatError();
    for (let index = 0; index < body.length; index += RECORD_BYTES) {
      records.push(body.slice(index, index + RECORD_BYTES));
    }
    return records;
  }

  if (body.length - start !== RECORD_BYTES) formatError();
  records.push(body.slice(start));
  return records;
}

function assertRecordType(record: Uint8Array, expected: string) {
  if (field(record, 0, 2) !== expected) formatError();
}

export function parseGiroBytes(bytes: Uint8Array): GiroFile {
  const records = splitRecords(bytes);
  if (records.length < 2) formatError();

  assertRecordType(records[0], "11");
  assertRecordType(records[records.length - 1], "33");
  for (let index = 1; index < records.length - 1; index += 1) {
    assertRecordType(records[index], "22");
  }

  const giroNo = digits(records[0], 2, 7);
  const depositedAtRaw = digits(records[0], 17, 8);
  const depositedAt = dateValue(depositedAtRaw);
  const giroRecords: GiroRecord[] = [];

  for (let index = 1; index < records.length - 1; index += 1) {
    const record = records[index];
    const line = index + 1;
    const seq = digits(record, 2, 7);
    const paidAt = dateValue(digits(record, 9, 8));
    const recordDepositedAtRaw = digits(record, 17, 8);
    if (recordDepositedAtRaw !== depositedAtRaw) formatError();
    digits(record, 25, 7);
    digits(record, 32, 7);
    const txNo = digits(record, 39, 12);
    const customerNo = digits(record, 51, 20);
    const amountRaw = digits(record, 71, 13);
    const feeRaw = digits(record, 85, 4);
    const amount = numericValue(amountRaw);
    const fee = numericValue(feeRaw);
    if (amount <= 0) formatError();
    const { buildingCode, roomNo, period } = periodValue(customerNo, line);

    giroRecords.push({
      rowIndex: index - 1,
      seq,
      paidAt,
      depositedAt,
      txNo,
      customerNo,
      buildingCode,
      roomNo,
      period,
      amount,
      fee,
      channel: field(record, 84, 1).trim(),
      externalRef: `GR15:${recordDepositedAtRaw}:${txNo}:${customerNo}`,
    });
  }

  const trailer = records[records.length - 1];
  const recordCount = giroRecords.length;
  const trailerCount1 = numericValue(digits(trailer, 2, 7));
  const trailerCount2 = numericValue(digits(trailer, 9, 7));
  const trailerAmount = numericValue(digits(trailer, 16, 14));
  const trailerFee = numericValue(digits(trailer, 30, 14));
  const unknown = digits(trailer, 44, 14);
  const netDeposit = numericValue(digits(trailer, 58, 14));
  const totalAmount = giroRecords.reduce((sum, record) => sum + record.amount, 0);
  const totalFee = giroRecords.reduce((sum, record) => sum + record.fee, 0);

  if (
    trailerCount1 !== recordCount
    || trailerCount2 !== recordCount
    || trailerAmount !== totalAmount
    || trailerFee !== totalFee
    || unknown !== "0".repeat(14)
    || netDeposit !== totalAmount - totalFee
  ) {
    checksumError();
  }

  return { giroNo, depositedAt, records: giroRecords, totalAmount, totalFee };
}

export async function parseGiroFile(file: File): Promise<GiroFile> {
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new GiroFileError("read-failed");
  }
  return parseGiroBytes(new Uint8Array(buffer));
}

export function displayGiroRoomNumber(roomNo: string): string {
  const trimmed = roomNo.trim().replace(/^0+/, "");
  return trimmed || "0";
}
