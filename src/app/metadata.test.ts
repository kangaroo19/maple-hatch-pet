import { describe, expect, it } from "vitest";

import { metadata } from "@/app/layout";
import {
  alt as openGraphAlt,
  contentType as openGraphContentType,
  size as openGraphSize,
} from "@/app/opengraph-image";
import {
  alt as twitterAlt,
  contentType as twitterContentType,
  size as twitterSize,
} from "@/app/twitter-image";

const title = "메이플스토리 Codex Pet 만들기 | Maple Hatch Pet";
const description =
  "메이플스토리 캐릭터 닉네임을 입력해 현재 외형과 공식 액션으로 Codex Pet을 만들고, 설치 명령으로 Codex에 추가하세요.";

describe("site metadata", () => {
  it("publishes the canonical search and social metadata", () => {
    expect(metadata).toMatchObject({
      applicationName: "Maple Hatch Pet",
      title,
      description,
      alternates: { canonical: "/" },
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
        siteName: "Maple Hatch Pet",
        title,
        description,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    });
    expect(metadata.metadataBase?.toString()).toBe(
      "https://maple-hatch-pet.vercel.app/",
    );
  });

  it("shares the required image contract across Open Graph and Twitter", () => {
    expect(openGraphSize).toEqual({ width: 1200, height: 630 });
    expect(twitterSize).toEqual(openGraphSize);
    expect(openGraphContentType).toBe("image/png");
    expect(twitterContentType).toBe(openGraphContentType);
    expect(openGraphAlt).toBe("Maple Hatch Pet — Create your Codex Pet");
    expect(twitterAlt).toBe(openGraphAlt);
  });
});
