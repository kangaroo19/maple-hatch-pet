# Maple Hatch Pet 개발환경

- 상태: 확정
- 최종 수정: 2026-08-09
- 관련 문서: [제품 명세 인덱스](./product-spec/index.md)

## 1. 목적

이 문서는 Maple Hatch Pet을 구현하고 배포할 때 사용할 개발환경, API와 운영 도구 계약을 정의한다. MVP는 비상업 개인 프로젝트로 Vercel Hobby에 배포한다.

## 2. 기술 스택

| 영역 | 선택 | 역할 |
|---|---|---|
| 런타임 | Node.js 24.x | 로컬 개발과 Vercel Function 실행 |
| 패키지 관리 | npm | 의존성 설치와 스크립트 실행 |
| 웹 프레임워크 | Next.js 16 App Router, React 19 | 웹 UI와 서버 Route Handler |
| 언어 | TypeScript strict mode | 클라이언트·서버 공통 타입 검사 |
| 번들러 | Webpack | 개발 서버와 프로덕션 빌드 |
| 스타일 | Tailwind CSS 4 | UI 스타일링 |
| 객체 저장소 | Vercel Blob 공개 저장소 | 생성된 PNG 스프라이트 시트 공개와 삭제 |
| 이미지 처리 | Sharp | 프레임 분석, 변환, 합성과 인코딩 |
| 배포 | Vercel | Next.js 웹과 Node.js Route Handler 실행 |

shadcn/ui 같은 별도 UI 컴포넌트 시스템은 MVP에 도입하지 않는다. 필요한 UI는 프로젝트 컴포넌트와 Tailwind 유틸리티로 구성한다.

## 3. 필수 로컬 환경

- Node.js 24.x
- npm
- Git

현재 프로젝트를 시작할 때 확인한 로컬 기준 버전은 다음과 같다.

```text
Node.js 24.13.0
npm 11.6.2
```

`package.json`의 `engines.node`는 `24.x`로 고정한다. 패치 버전은 Node.js 24의 보안·버그 수정 릴리스를 받을 수 있도록 고정하지 않는다. 설치 결과인 `package-lock.json`은 커밋한다.

데이터베이스와 로컬 객체 저장소 에뮬레이터는 MVP의 필수 개발환경에 포함하지 않는다. 로컬과 Preview는 Non-production Vercel Blob 공개 저장소를 함께 사용하고 Production 저장소와 자격 증명은 분리한다.

## 4. Next.js 프로젝트 계약

- App Router를 사용한다.
- 애플리케이션 코드는 `src/` 아래에 둔다.
- import alias는 `@/*`를 사용한다.
- Server Component를 기본으로 하고 상태, 이벤트 또는 브라우저 API가 필요한 경계만 Client Component로 만든다.
- NEXON API 키, 객체 저장소 쓰기 자격 증명과 이미지 생성 코드는 서버 전용 모듈에 둔다.
- 이미지 생성 Route Handler는 Node.js 런타임을 명시한다. Edge Runtime에서는 Sharp를 실행하지 않는다.

Next.js 16은 Turbopack을 기본으로 사용하므로 개발과 빌드 스크립트 모두 `--webpack`을 명시해야 한다.

```json
{
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack",
    "start": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier . --write",
    "format:check": "prettier . --check",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run lint && npm run format:check && npm run typecheck && npm run test && npm run build"
  }
}
```

주요 패키지는 다음 메이저 버전을 사용하고 정확한 설치 버전은 `package-lock.json`으로 고정한다.

```text
next 16
react 19
react-dom 19
tailwindcss 4
sharp
@vercel/blob
```

## 5. 이미지 생성 실행 모델

MVP의 Pet 생성은 하나의 Node.js Route Handler가 동기로 처리한다.

```text
생성 요청
→ NEXON 데이터와 프레임 조회
→ Sharp 변환·합성
→ 결과 검증
→ Vercel Blob 공개 저장소 업로드
→ 결과 응답
```

- 생성이 끝날 때까지 브라우저는 대기 상태를 표시한다.
- 같은 화면에서 생성 버튼을 중복 실행하지 못하게 한다.
- 이미지 생성 Route Handler에는 `runtime = "nodejs"`와 Vercel Hobby 한도에 맞춘 `maxDuration = 60`을 명시한다.
- 서버 내부 생성 제한은 50초로 두고 그 전에 `503 SERVICE_UNAVAILABLE`로 종료해 응답 여유를 확보한다.
- 출시 성능 목표는 정상 생성 요청의 전체 처리 시간 45초 이하다.
- 처리 시간이 내부 제한을 반복해서 넘는 것이 관찰되기 전에는 작업 큐와 별도 워커를 추가하지 않는다.
- 이미지 파일 자체를 Function 응답에 포함하지 않는다. 객체 저장소에 발행한 뒤 결과 URL과 딥링크만 반환한다.

## 6. 객체 저장소 개발 방식

MVP는 Supabase, 데이터베이스나 설치 메타데이터 저장소를 사용하지 않는다. 생성된 PNG를 ChatGPT 데스크톱 앱이 내려받을 수 있게 Vercel Blob 공개 저장소만 사용한다.

객체 저장소는 다음 조건을 만족해야 한다.

- `@vercel/blob` 서버 SDK와 서버 전용 쓰기 토큰으로 업로드한다.
- public access로 생성해 업로드한 객체를 인증 없이 절대 HTTPS URL로 내려받게 한다.
- 생성 결과마다 고유한 객체 경로를 사용하고 기존 URL의 내용을 덮어쓰지 않는다.
- 객체 경로는 `pets/` 접두사 아래에 두고 PNG의 올바른 콘텐츠 타입과 캐시 정책을 설정한다.
- 20 MiB 이하 파일을 지원한다.
- 개발·Preview와 Production 저장소 및 자격 증명을 분리할 수 있다.

브라우저에는 객체 저장소 SDK나 쓰기 자격 증명을 제공하지 않는다. Vercel Function의 로컬 파일 시스템은 생성 중 임시 작업에만 사용하고, 검증된 결과는 응답 전에 객체 저장소에 업로드한다.

Production과 Non-production은 별개의 public Blob store다. 로컬과 Preview는 Non-production 저장소를 사용하며 어느 환경에서도 다른 환경의 쓰기 토큰을 대체 값으로 사용하지 않는다.

## 7. 환경변수

저장소에는 다음 형태의 `.env.example`을 만들고 실제 값은 넣지 않는다.

```dotenv
# NEXON Open API 서버 키
NEXON_API_KEY=

# Production Vercel Blob public store 쓰기 토큰
BLOB_READ_WRITE_TOKEN=

# 로컬·Preview Vercel Blob public store 쓰기 토큰
BLOB_NONPROD_READ_WRITE_TOKEN=

# Vercel Cron 내부 정리 API 인증값
CRON_SECRET=
```

네 값은 모두 서버 전용이다. `NEXT_PUBLIC_` 접두사를 붙이지 않으며 Client Component, 브라우저 응답, 로그, 자산 URL과 딥링크에 포함하지 않는다. Production 업로드와 정리 작업은 `BLOB_READ_WRITE_TOKEN`, 로컬·Preview 업로드는 `BLOB_NONPROD_READ_WRITE_TOKEN`을 명시적으로 사용한다.

환경별 값은 다음과 같이 관리한다.

| 환경 | 값 저장 위치 |
|---|---|
| 로컬 개발 | Git에서 제외한 `.env.local`의 `NEXON_API_KEY`, `BLOB_NONPROD_READ_WRITE_TOKEN` |
| Vercel Preview | Preview 범위의 `NEXON_API_KEY`, `BLOB_NONPROD_READ_WRITE_TOKEN` |
| Vercel Production | Production 범위의 `NEXON_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET` |

객체 저장소의 개발·Preview와 Production 자원도 분리한다. 개발 또는 Preview 환경에서 운영 쓰기 자격 증명을 사용하지 않는다.

## 8. 품질 도구와 테스트

| 도구 | 책임 |
|---|---|
| ESLint | Next.js, React와 TypeScript 정적 검사 |
| Prettier | Markdown, JSON, TypeScript와 스타일 파일 포맷 |
| Vitest | 입력 정규화, 프레임 계획, 이미지 변환과 검증 로직의 단위 테스트 |
| Playwright | 캐릭터 조회부터 Pet 생성 결과까지 핵심 브라우저 흐름 |

일상적인 개발 흐름은 다음과 같다.

```bash
npm install
npm run dev
```

커밋 전에는 빠른 전체 검증을 실행한다.

```bash
npm run check
```

핵심 사용자 흐름이나 브라우저 상호작용을 변경했으면 E2E 테스트를 추가로 실행한다.

```bash
npm run test:e2e
```

`npm run check`는 E2E 테스트를 포함하지 않는다. E2E는 실행 시간이 길고 외부 서비스 대역이 필요할 수 있으므로 별도 명령으로 유지한다.

## 9. 배포 계약

- Vercel Hobby의 비상업 개인 프로젝트로만 운영한다. 상업화 전에 NEXON 허가와 Vercel 요금제를 다시 검토한다.
- Vercel은 Git 저장소와 연결하고 `package-lock.json`을 기준으로 `npm install`을 실행한다.
- 빌드 명령은 `npm run build`이며 내부적으로 Webpack 빌드를 사용한다.
- Route Handler는 Node.js 런타임에서 실행한다.
- 개발·Preview와 Production 환경변수를 분리한다.
- 스프라이트 시트는 Vercel Function 응답이나 로컬 파일 시스템에 영구 저장하지 않고 환경별 Vercel Blob 공개 저장소에 저장한다.
- Production과 Non-production Blob 저장소를 분리한다. Preview와 로컬에서 Production 쓰기 토큰을 사용하지 않는다.
- Vercel 배포 전에 `npm run check`를 통과해야 한다.

## 10. API, 정리와 요청 제한

- `POST /api/characters/lookup`: 닉네임으로 현재 캐릭터를 조회한다.
- `POST /api/pets`: 최신 캐릭터를 다시 조회하고 v1 PNG를 생성해 `spritesheetUrl`, `deepLink`, `expiresAt`을 반환한다.
- `GET /api/internal/cron/pet-assets`: Production의 만료된 `pets/` 객체를 정리한다.
- 세 API의 JSON과 오류 계약은 [Pet 생성 흐름](./product-spec/pet-generation-flow.md#3-api-계약)을 따른다.

Vercel Cron은 `0 3 * * *`로 하루 한 번 등록한다. 내부 정리 API는 `Authorization: Bearer <CRON_SECRET>`를 검증하고 Production Blob 저장소의 `pets/` 객체를 cursor로 끝까지 순회해 `uploadedAt`이 28일 이상 지난 객체만 삭제한다. 삭제는 같은 객체를 다시 처리해도 안전해야 한다. Hobby Cron은 03:00~03:59 UTC 사이에 실행될 수 있으므로 사용자에게는 28일 유효기간을 안내한다. 실패한 실행은 대시보드에서 확인해 같은 내부 API를 수동 재실행하고 최대 30일 안에는 반드시 삭제한다.

Vercel WAF의 프로젝트당 rate limit 규칙 하나는 다음과 같이 고정한다.

| 조건 | 값 |
|---|---|
| 메서드·경로 | `POST /api/pets` |
| 식별 키 | IP |
| 알고리즘 | Fixed Window |
| 허용량 | 10분당 3회 |
| 초과 응답 | HTTP 429 |

브라우저의 생성 버튼 비활성화는 사용자 경험을 위한 중복 방지일 뿐 서버 측 WAF를 대체하지 않는다.

## 11. 운영 관찰

- 외부 모니터링 서비스는 도입하지 않는다.
- Vercel Functions 대시보드에서 경로별 호출 수, 오류, 처리 시간과 50초 내부 제한 발생을 확인한다.
- Vercel Cron 대시보드와 실행 로그에서 일일 정리 호출, 삭제 개수와 실패를 확인한다.
- Vercel Blob 대시보드에서 환경별 저장량, `pets/` 객체 수와 삭제 추이를 확인한다.
- 구조화 로그에는 요청 ID, API 경로, 단계, 처리 시간, HTTP 상태, 오류 코드와 정리 개수만 남긴다.
- 닉네임, OCID, 원본·생성 이미지 URL, API 키, Blob 토큰과 Cron 비밀값은 로그에 남기지 않는다.

## 12. 참고 자료

- [Next.js 설치](https://nextjs.org/docs/app/getting-started/installation)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Vercel Function 실행 시간 설정](https://vercel.com/docs/functions/configuring-functions/duration)
- [Vercel Blob](https://vercel.com/docs/vercel-blob)
- [Vercel Cron 사용량과 실행 정밀도](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Cron 관리와 `CRON_SECRET`](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
