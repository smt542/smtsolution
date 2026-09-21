export type PiiRevealInput = {
  targetKind: string;
  targetId: string | number;
  field: string;
};

export type PiiRevealBatchInput = {
  targetKind: string;
  targetId: string | number;
  fields: readonly string[];
};

type PiiRevealResponse = {
  value: string | null;
};

type PiiRevealBatchResponse = {
  values: Record<string, string | null>;
};

function isPiiRevealResponse(value: unknown): value is PiiRevealResponse {
  if (typeof value !== "object" || value === null || !("value" in value)) return false;
  return typeof value.value === "string" || value.value === null;
}

function isPiiRevealBatchResponse(
  value: unknown,
  fields: readonly string[],
): value is PiiRevealBatchResponse {
  if (typeof value !== "object" || value === null || !("values" in value)) return false;
  if (typeof value.values !== "object" || value.values === null || Array.isArray(value.values)) {
    return false;
  }
  const values = value.values as Record<string, unknown>;

  return fields.every((field) => {
    if (!Object.hasOwn(values, field)) return false;
    const fieldValue = values[field];
    return typeof fieldValue === "string" || fieldValue === null;
  });
}

export async function revealPii(input: PiiRevealInput): Promise<string | null> {
  const response = await fetch("/api/pii/reveal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok || !isPiiRevealResponse(body)) {
    throw new Error("원문을 불러오지 못했습니다.");
  }

  return body.value;
}

export async function revealPiiBatch(
  input: PiiRevealBatchInput,
): Promise<Record<string, string | null>> {
  const response = await fetch("/api/pii/reveal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, fields: [...input.fields] }),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok || !isPiiRevealBatchResponse(body, input.fields)) {
    throw new Error("전화번호 원문을 불러오지 못했습니다.");
  }

  return body.values;
}
