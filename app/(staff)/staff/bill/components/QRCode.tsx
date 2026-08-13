"use client";

import { useEffect, useState } from "react";
import QR from "qrcode";

export interface QRCodeProps {
  value: string;
  size?: number;
}

export function QRCode({ value, size = 96 }: QRCodeProps) {
  const renderKey = `${size}:${value}`;
  const [image, setImage] = useState<{ key: string; src: string } | null>(null);

  useEffect(() => {
    let active = true;

    QR.toDataURL(value, { width: size, margin: 0 })
      .then((dataUrl) => {
        if (active) setImage({ key: renderKey, src: dataUrl });
      })
      .catch(() => {
        if (active) {
          setImage((current) => (current?.key === renderKey ? null : current));
        }
      });

    return () => {
      active = false;
    };
  }, [renderKey, size, value]);

  if (image?.key !== renderKey) {
    return <div aria-hidden style={{ width: size, height: size }} />;
  }

  // QR은 런타임에 생성되는 data URL이라 Next 이미지 최적화 대상이 아니다.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.src} width={size} height={size} alt="QR코드" />;
}
