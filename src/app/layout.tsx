import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

const SITE_NAME = "Maple Hatch Pet";
const SITE_TITLE = "메이플스토리 Codex Pet 만들기 | Maple Hatch Pet";
const SITE_DESCRIPTION =
  "메이플스토리 캐릭터 닉네임을 입력해 현재 외형과 공식 액션으로 Codex Pet을 만들고, 설치 명령으로 Codex에 추가하세요.";

export const metadata: Metadata = {
  metadataBase: new URL("https://maple-hatch-pet.vercel.app"),
  applicationName: SITE_NAME,
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
