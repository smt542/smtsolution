import type { MetadataRoute } from "next";

// 안드로이드 "홈 화면에 추가" 이름·아이콘. 4개 롤이 함께 쓰므로 start_url을 두지 않아 추가한 화면이 그대로 열리고,
// display "browser"라 설치형 앱(전체 화면)으로 바뀌지 않는다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "관리비서",
    short_name: "관리비서",
    display: "browser",
    icons: [
      { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
