# Maple Hatch Pet 개발환경

- 상태: 확정
- 최종 수정: 2026-08-09
- 관련 문서: [제품 명세 인덱스](./product-spec/index.md)

## 1. 목적

이 문서는 Maple Hatch Pet을 구현하고 배포할 때 사용할 개발환경과 도구 계약을 정의한다. 실제 객체 저장소 사업자, 객체 경로와 공개 API 스키마는 후속 구현 설계에서 정한다.

## 2. 기술 스택

| 영역 | 선택 | 역할 |
|---|---|---|
| 런타임 | Node.js 24.x | 로컬 개발과 Vercel Function 실행 |
| 패키지 관리 | npm | 의존성 설치와 스크립트 실행 |
| 웹 프레임워크 | Next.js 16 App Router, React 19 | 웹 UI와 서버 Route Handler |
| 언어 | TypeScript strict mode | 클라이언트·서버 공통 타입 검사 |
| 번들러 | Webpack | 개발 서버와 프로덕션 빌드 |
| 스타일 | Tailwind CSS 4 | UI 스타일링 |
| 객체 저장소 | 공급자 미정 공개 HTTPS 객체 저장소 | 생성된 스프라이트 시트 공개 |
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

데이터베이스와 로컬 객체 저장소 에뮬레이터는 MVP의 필수 개발환경에 포함하지 않는다. 객체 저장소 사업자를 결정한 뒤 개발용 원격 저장소와 자격 증명을 별도로 구성한다.

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
```

## 5. 이미지 생성 실행 모델

MVP의 Pet 생성은 하나의 Node.js Route Handler가 동기로 처리한다.

```text
생성 요청
→ NEXON 데이터와 프레임 조회
→ Sharp 변환·합성
→ 결과 검증
→ 공개 HTTPS 객체 저장소 업로드
→ 결과 응답
```

- 생성이 끝날 때까지 브라우저는 대기 상태를 표시한다.
- 같은 화면에서 생성 버튼을 중복 실행하지 못하게 한다.
- Route Handler에는 `runtime = "nodejs"`와 Vercel Hobby 한도에 맞춘 `maxDuration = 300`을 명시한다.
- 실제 처리 시간이 실행 한도에 가까워지거나 타임아웃이 관찰되기 전에는 작업 큐와 별도 워커를 추가하지 않는다.
- 이미지 파일 자체를 Function 응답에 포함하지 않는다. 객체 저장소에 발행한 뒤 결과 URL과 딥링크만 반환한다.

## 6. 객체 저장소 개발 방식

MVP는 데이터베이스나 설치 메타데이터 저장소를 사용하지 않는다. 생성된 스프라이트 시트를 ChatGPT 데스크톱 앱이 내려받을 수 있게 공개 HTTPS 객체 저장소만 사용한다.

객체 저장소는 다음 조건을 만족해야 한다.

- 서버 전용 자격 증명으로 업로드할 수 있다.
- 업로드한 객체를 인증 없이 절대 HTTPS URL로 내려받을 수 있다.
- 생성 결과마다 고유한 객체 경로를 사용하고 기존 URL의 내용을 덮어쓰지 않는다.
- PNG와 lossless WebP의 올바른 콘텐츠 타입과 캐시 정책을 설정할 수 있다.
- 20 MiB 이하 파일을 지원한다.
- 개발·Preview와 Production 저장소 및 자격 증명을 분리할 수 있다.

브라우저에는 객체 저장소 SDK나 쓰기 자격 증명을 제공하지 않는다. Vercel Function의 로컬 파일 시스템은 생성 중 임시 작업에만 사용하고, 검증된 결과는 응답 전에 객체 저장소에 업로드한다.

사업자, SDK, bucket과 객체 경로는 구현 계획에서 함께 결정한다. 사업자를 선택하기 전에는 특정 SDK나 공급자 전용 환경변수를 프로젝트 계약에 추가하지 않는다.

## 7. 환경변수

저장소에는 다음 형태의 `.env.example`을 만들고 실제 값은 넣지 않는다.

```dotenv
# NEXON Open API 서버 키
NEXON_API_KEY=
```

`NEXON_API_KEY`는 서버 전용이다. `NEXT_PUBLIC_` 접두사를 붙이지 않으며 Client Component, 브라우저 응답, 로그, 자산 URL과 딥링크에 포함하지 않는다.

객체 저장소 사업자를 결정하면 서버 업로드에 필요한 환경변수 이름을 `.env.example`에 추가한다. 해당 자격 증명도 서버 전용으로 유지하고 브라우저에 노출하지 않는다.

환경별 값은 다음과 같이 관리한다.

| 환경 | 값 저장 위치 |
|---|---|
| 로컬 개발 | Git에서 제외한 `.env.local` |
| Vercel Preview | Vercel Preview 환경변수 |
| Vercel Production | Vercel Production 환경변수 |

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

- Vercel은 Git 저장소와 연결하고 `package-lock.json`을 기준으로 `npm install`을 실행한다.
- 빌드 명령은 `npm run build`이며 내부적으로 Webpack 빌드를 사용한다.
- Route Handler는 Node.js 런타임에서 실행한다.
- 개발·Preview와 Production 환경변수를 분리한다.
- 스프라이트 시트는 Vercel Function 응답이나 로컬 파일 시스템에 영구 저장하지 않고 선택한 공개 HTTPS 객체 저장소에 저장한다.
- Vercel 배포 전에 `npm run check`를 통과해야 한다.

## 10. 후속 구현에서 결정할 사항

다음 내용은 개발환경이 아니라 구현 설계에서 확정한다.

- 객체 저장소 사업자, SDK, bucket 이름과 객체 경로
- Route Handler URL과 JSON 요청·응답 스키마
- NEXON 요청 제한과 요청 범위 중복 제거의 구체적인 구현
- 동기 생성의 성능 기준과 비동기 전환 조건

## 11. 참고 자료

- [Next.js 설치](https://nextjs.org/docs/app/getting-started/installation)
- [Vercel Function 제한](https://vercel.com/docs/functions/limitations)
