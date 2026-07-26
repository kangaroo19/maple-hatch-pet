# Maple Hatch Pet 개발환경

- 상태: 확정
- 최종 수정: 2026-07-26
- 관련 문서: [제품 명세 인덱스](./product-spec/index.md)

## 1. 목적

이 문서는 Maple Hatch Pet을 구현하고 배포할 때 사용할 개발환경과 도구 계약을 정의한다. 실제 데이터베이스 테이블, Storage 객체 경로와 공개 API 스키마는 후속 구현 설계에서 정한다.

## 2. 기술 스택

| 영역 | 선택 | 역할 |
|---|---|---|
| 런타임 | Node.js 24.x | 로컬 개발과 Vercel Function 실행 |
| 패키지 관리 | npm | 의존성 설치와 스크립트 실행 |
| 웹 프레임워크 | Next.js 16 App Router, React 19 | 웹 UI와 서버 Route Handler |
| 언어 | TypeScript strict mode | 클라이언트·서버 공통 타입 검사 |
| 번들러 | Webpack | 개발 서버와 프로덕션 빌드 |
| 스타일 | Tailwind CSS 4 | UI 스타일링 |
| 데이터베이스 | Supabase Postgres | Pet 메타데이터와 조회 캐시 저장 |
| 객체 저장소 | Supabase Storage | 생성된 스프라이트 시트 공개 |
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

Supabase는 원격 개발 프로젝트를 사용한다. 로컬 Supabase 전체 스택과 Docker는 필수 개발환경에 포함하지 않는다.

## 4. Next.js 프로젝트 계약

- App Router를 사용한다.
- 애플리케이션 코드는 `src/` 아래에 둔다.
- import alias는 `@/*`를 사용한다.
- Server Component를 기본으로 하고 상태, 이벤트 또는 브라우저 API가 필요한 경계만 Client Component로 만든다.
- NEXON API 키, Supabase secret key와 이미지 생성 코드는 서버 전용 모듈에 둔다.
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
@supabase/supabase-js 2
sharp
```

## 5. 이미지 생성 실행 모델

MVP의 Pet 생성은 하나의 Node.js Route Handler가 동기로 처리한다.

```text
생성 요청
→ NEXON 데이터와 프레임 조회
→ Sharp 변환·합성
→ 결과 검증
→ Supabase Storage 업로드
→ Pet 메타데이터 저장
→ 결과 응답
```

- 생성이 끝날 때까지 브라우저는 대기 상태를 표시한다.
- 같은 화면에서 생성 버튼을 중복 실행하지 못하게 한다.
- Route Handler에는 `runtime = "nodejs"`와 Vercel Hobby 한도에 맞춘 `maxDuration = 300`을 명시한다.
- 단계별 소요 시간과 전체 생성 시간을 기록한다.
- 실제 처리 시간이 실행 한도에 가까워지거나 타임아웃이 관찰되기 전에는 작업 큐와 별도 워커를 추가하지 않는다.
- 이미지 파일 자체를 Function 응답에 포함하지 않는다. Supabase Storage에 저장한 뒤 결과 URL만 반환한다.

## 6. Supabase 개발 방식

Supabase는 다음 두 기능만 사용한다.

- Postgres: Pet 메타데이터와 NEXON 조회 캐시
- 공개 Storage bucket: 설치 가능한 스프라이트 시트

브라우저는 Supabase SDK나 키를 받지 않고 Next.js 서버를 통해서만 데이터에 접근한다. 생성 자산은 설치에 필요한 고유한 HTTPS URL로 공개한다.

Supabase CLI는 프로젝트 dev dependency로 설치하고 `npx`로 실행한다.

```bash
npm install --save-dev supabase
npx supabase login
npx supabase link --project-ref <development-project-ref>
```

데이터베이스 변경은 다음 원칙을 따른다.

1. `supabase/migrations/`의 SQL 마이그레이션을 스키마 원본으로 관리한다.
2. Dashboard에서 테이블이나 정책을 직접 변경하지 않는다.
3. 원격 개발 프로젝트에 반영하기 전 변경 내용을 리뷰한다.
4. 마이그레이션 반영 후 TypeScript 타입을 다시 생성해 커밋한다.

```bash
npx supabase db push
npx supabase gen types typescript --linked --schema public > src/types/database.generated.ts
```

로컬 Docker를 사용하지 않으므로 `supabase start`와 `supabase db reset`은 기본 개발 절차에 포함하지 않는다.

## 7. 환경변수

저장소에는 다음 형태의 `.env.example`을 만들고 실제 값은 넣지 않는다.

```dotenv
# NEXON Open API 서버 키
NEXON_API_KEY=

# 서버에서 사용하는 Supabase 프로젝트 URL
SUPABASE_URL=

# 서버 전용 Supabase secret key
SUPABASE_SECRET_KEY=
```

세 값은 모두 서버 전용이다. `NEXT_PUBLIC_` 접두사를 붙이지 않으며 Client Component, 브라우저 응답, 로그와 생성된 Pet 메타데이터에 포함하지 않는다.

환경별 값은 다음과 같이 관리한다.

| 환경 | 값 저장 위치 | Supabase 대상 |
|---|---|---|
| 로컬 개발 | Git에서 제외한 `.env.local` | 원격 개발 프로젝트 |
| Vercel Preview | Vercel Preview 환경변수 | 원격 개발 프로젝트 |
| Vercel Production | Vercel Production 환경변수 | 별도 운영 프로젝트 |

운영 Supabase 프로젝트는 출시 전에 개발 프로젝트와 분리한다. 개발 또는 Preview 환경에서 운영 secret key를 사용하지 않는다.

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
- 스프라이트 시트는 Vercel Function 응답이나 로컬 파일 시스템에 영구 저장하지 않고 Supabase Storage에 저장한다.
- Vercel 배포 전에 `npm run check`를 통과해야 한다.

## 10. 후속 구현에서 결정할 사항

다음 내용은 개발환경이 아니라 구현 설계에서 확정한다.

- Pet과 NEXON 조회 캐시의 테이블 구조
- `petId` 발급 방식
- Storage bucket 이름과 객체 경로
- Route Handler URL과 JSON 요청·응답 스키마
- NEXON 요청 제한과 캐시의 구체적인 구현
- 동기 생성의 성능 기준과 비동기 전환 조건

## 11. 참고 자료

- [Next.js 설치](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase 로컬 개발 흐름](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Vercel Function 제한](https://vercel.com/docs/functions/limitations)
