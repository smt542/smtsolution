export function byteLen(s: string): number {
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  return n;
}
export function smsProduct(bytes: number): "SMS" | "LMS" {
  return bytes <= 90 ? "SMS" : "LMS";
}
