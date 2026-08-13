"use client";
import { QRCodeSVG } from "qrcode.react";

export function QrCode({ value, size = 88 }: { value: string; size?: number }) {
  return <QRCodeSVG value={value} size={size} aria-label="고지서 QR" />;
}
