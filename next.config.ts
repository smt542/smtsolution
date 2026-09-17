import type { NextConfig } from "next";

// Supabase Storage 서명 URL을 next/image 옵티마이저에 허용한다.
// - 호스트는 환경마다 다르므로 NEXT_PUBLIC_SUPABASE_URL에서 유도한다(클라이언트 번들에 인라인되는
//   값이라 빌드 타임에 이미 존재한다). 없으면 빈 배열 → 외부 이미지 전면 차단(기본 동작).
// - `search`는 반드시 생략한다. 생략 시 `**`가 암시되어 모든 쿼리스트링이 허용된다.
//   `search: ""`로 두면 쿼리스트링이 금지되어 `?token=...`이 붙는 서명 URL이 전부 400이 된다.
// - `/storage/v1/**`는 원본(`object/sign`)과 Supabase 이미지 변환(`render/image/sign`) 경로를
//   모두 덮는다(lib/attachments/signedUrl.ts의 IMAGE_TRANSFORM_PRESETS 참고).
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            port: "",
            pathname: "/storage/v1/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
