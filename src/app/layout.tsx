import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Maple Hatch Pet",
  description: "메이플스토리 캐릭터로 Codex Pet을 만듭니다.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <footer className="site-footer">
          <span>Data based on NEXON Open API</span>
          <Link href="/privacy">개인정보 처리 안내</Link>
        </footer>
      </body>
    </html>
  );
}
