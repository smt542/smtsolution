export type PiiRevealInput = {
  targetKind: string;
  targetId: string | number;
  field: string;
};

type PiiRevealResponse = {
  value: string | null;
};

function isPiiRevealResponse(value: unknown): value is PiiRevealResponse {
  if (typeof value !== "object" || value === null || !("value" in value)) return false;
  return typeof value.value === "string" || value.value === null;
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
