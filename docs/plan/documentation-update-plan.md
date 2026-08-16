# CLI 설치 전환 문서화 실행계획

- 상태: 실행 대기
- 목적: 기존 Codex 딥링크 설치 계약을 제거하고 CLI 전용 Pet 설치 계약으로 현재 기준 문서를 정렬한다.
- 후속 계획: [CLI 설치 흐름 구현계획](./pet-installation-implementation-plan.md)
- 실행 제약: 이 계획을 수행할 때 서브에이전트를 생성하지 않고 단일 에이전트가 직접 작업한다.

## 1. 확정된 결정

- Pet 설치는 CLI만 지원한다.
- `codex://pets/install`과 `codex://new?prompt=...`는 제품 계약과 UI에서 모두 제거한다.
- npm 패키지와 실행 바이너리 이름은 모두 `maple-hatch-pet`이며 설치 명령은 `npx maple-hatch-pet add <petId>`다.
- 생성 결과마다 UUID 기반 `petId`와 `.codex-pet.zip`을 발행한다.
- 패키지는 `pet.json`과 v1 `spritesheet.png`를 포함한다.
- CLI는 패키지를 사용자 홈 아래 `.codex/pets/<petId>`에 설치한다.
- Supabase와 다른 데이터베이스는 도입하지 않고 Vercel Blob을 유지한다.
- 생성 패키지는 현재 정책과 같이 28일간 유효하며 최대 30일 이내 삭제한다.

## 2. 확정된 구현 결정

문서와 후속 구현은 다음 결정을 따른다.

1. npm 패키지와 실행 바이너리 이름은 모두 `maple-hatch-pet`으로 고정한다.
2. 같은 `petId`가 이미 설치되어 있으면 별도 확인이나 `--force` 없이 검증된 새 패키지로 교체한다.
3. 새 패키지의 다운로드와 검증에 실패하면 기존 설치를 보존한다.
4. 설치 모달에는 ZIP 직접 다운로드를 노출하지 않고 CLI만 공식 설치 방식으로 안내한다.

직접 `curl`·`unzip` 또는 운영체제별 수동 설치 명령은 MVP에 포함하지 않는다. npm 패키지 이름의 공개 레지스트리 사용 가능 여부는 실제 게시 직전에 다시 확인한다.

## 3. 수정할 문서

### `README.md`

- 제품 설명을 딥링크 설치에서 CLI 설치로 변경한다.
- 새 CLI 설치 계약 문서를 문서 목록에 연결한다.
- 현재 실행계획 문서가 완료되면 계획 링크를 유지할지 제거할지 확인한다.

### `docs/product-spec/index.md`

- 제품 한 줄 설명에서 딥링크를 CLI 설치로 교체한다.
- 설치 계약 설명을 CLI 설치 흐름과 패키지 계약으로 갱신한다.
- 새 `cli-installation-contract.md`를 읽기 순서에 추가한다.

### `docs/product-spec/mvp.md`

- MVP 목표와 핵심 사용자 흐름에 `petId`, 패키지 생성, 설치 명령 복사와 터미널 실행을 반영한다.
- 제외 범위에서 CLI, 로컬 Pet 설치와 설치 식별자를 제거한다.
- FR-4의 자산 보관 계약을 PNG 단독 발행에서 `.codex-pet.zip` 발행으로 바꾼다.
- FR-5를 설치 명령 표시·복사 모달로 바꾼다.
- FR-6을 딥링크 설치에서 CLI 설치로 교체한다.
- 서비스 경계, 오류 처리, 보안 요구사항, 완료 조건과 외부 전제를 새 흐름에 맞춘다.
- Node.js와 npm이 없는 사용자는 CLI 설치를 사용할 수 있음을 보장하지 않는다고 명시한다.

### `docs/product-spec/pet-generation-flow.md`

- `POST /api/pets` 성공 응답에서 `spritesheetUrl`과 `deepLink`를 제거한다.
- 성공 응답에 `petId`, `packageUrl`, `installCommand`, `expiresAt`을 정의한다.
- PNG 검증 뒤 `pet.json` 생성, ZIP 조립, ZIP 검증과 패키지 발행 단계를 추가한다.
- 패키지 다운로드 API와 만료·미존재·저장소 장애 응답을 정의한다.
- Blob 객체 접두사와 Cron 정리 대상을 Pet 패키지에 맞춘다.
- DB 없이 `petId`와 Blob 객체를 연결하는 규칙을 고정한다.

### `docs/product-spec/installation-contract.md`

- 문서 목적을 공식 딥링크 설치에서 CLI 설치의 사용자 계약으로 바꾼다.
- 지원 표면을 Node.js와 npm을 사용할 수 있는 로컬 환경 중심으로 다시 정의한다.
- 설치 명령 표시, 복사, 터미널 실행, 설치 완료 후 Pets 새로고침과 선택 절차를 정의한다.
- 딥링크 파라미터, 기능 플래그와 앱 열기 실패 내용을 제거한다.
- 설치 명령의 28일 유효기간과 만료 시 재생성 절차를 정의한다.
- 세부 CLI 동작과 보안은 새 CLI 계약 문서로 위임한다.

### `docs/development-environment.md`

이 문서는 개발환경 범위만 유지하고 API·패키지·보안 계약을 중복하지 않는다.

- 기술 스택에 Node.js·TypeScript 기반 CLI와 npm 배포 단위를 추가한다.
- CLI 소스는 최상위 `cli/`에 두고 웹앱과 독립적인 진입점과 `package.json`을 갖는다고 명시한다.
- 필수 환경은 기존 Node.js 24.x, npm, Git을 재사용한다.
- CLI 개발·타입 검사·단위 테스트 명령의 이름과 책임만 추가한다.
- 웹은 Vercel, CLI는 npm으로 배포된다는 경계만 짧게 명시한다.
- 다운로드 API, 생성 응답, ZIP 구조, 설치 보안과 오류 코드는 다른 계약 문서로 위임한다.

### `docs/frontend/index.md`

- 설치 모달의 `Codex에 설치` 링크를 설치 명령 표시와 `설치 명령 복사` 버튼으로 교체한다.
- 복사 성공·실패, 명령 만료 안내와 설치 후 Pets 새로고침 안내를 정의한다.
- ZIP 직접 다운로드 링크나 수동 설치 절차는 제공하지 않는다.
- 결과 무효화, 모달 재열기, 포커스 복원 규칙은 현재 동작을 유지한다.
- 딥링크 지원 환경 안내를 제거한다.

### `docs/frontend/implementation-guide.md`

- 생성 성공 응답 타입을 `petId`, `packageUrl`, `installCommand`, `expiresAt`에 맞춘다.
- 설치 명령의 렌더링·복사와 접근 가능한 상태 안내 구현 순서를 추가한다.
- 기존 딥링크 anchor와 관련 완료 조건을 제거한다.
- 기존 Canvas 렌더링·카메라·WZ 자산 계약은 변경하지 않는다.

## 4. 추가할 문서

### `docs/product-spec/cli-installation-contract.md`

다음 독립 계약만 소유한다.

- npm 패키지·실행 바이너리 `maple-hatch-pet`과 `npx maple-hatch-pet add <petId>` 명령
- 옵션 없는 동일 ID 재설치와 검증 성공 후 안전한 교체 정책
- `pet.json` 스키마와 `.codex-pet.zip` 내부 구조
- 패키지 다운로드, 크기 제한과 만료 처리
- Node의 홈·경로 API를 사용한 `<user-home>/.codex/pets/<petId>` 경로 계산
- 임시 위치에서 검증한 뒤 최종 경로에 반영하는 설치 원자성
- 허용 origin, ZIP 경로 순회, 절대 경로, 심볼릭 링크와 용량 초과 방어
- 사용자에게 보여줄 오류와 CLI 종료 코드

운영체제별로 별도 설치 절차를 반복하지 않는다. Windows, macOS와 Linux에서 사용자 홈·임시 경로·경로 구분자를 하드코딩하지 않는다는 공통 계약만 정의한다.

## 5. 수정하지 않을 문서

- `docs/product-spec/action-emotion-catalog.md`
- `docs/frontend/map-login-renderer.md`
- `docs/superpowers/specs/`의 역사적 명세

현재 결정과 충돌하는 과거 기록은 수정하지 않고 현재 기준 문서에서만 새 계약을 확정한다.

## 6. 실행 순서

1. `installation-contract.md`와 새 `cli-installation-contract.md`에서 설치 책임을 먼저 분리한다.
2. `pet-generation-flow.md`에서 API와 패키지 생성 계약을 정렬한다.
3. `mvp.md`에서 사용자 흐름과 완료 조건을 정렬한다.
4. `development-environment.md`에 최소 개발환경 경계만 추가한다.
5. 프런트엔드 문서 두 개를 새 응답과 설치 모달에 맞춘다.
6. 제품 인덱스와 README의 설명·링크를 갱신한다.

## 7. 검증 원칙

문서화 단계의 기본 검증은 다음으로 제한한다.

- 변경 대상 문서에서 `codex://`, `deepLink`, 딥링크 설치와 CLI 제외 문구가 남았는지 `rg`로 확인한다.
- `petId`, `packageUrl`, `installCommand`, 패키지 유효기간과 문서 링크의 이름이 서로 일치하는지 확인한다.
- 새 문서와 상대 링크가 실제 경로를 가리키는지 확인한다.
- `git diff --check`와 변경 파일 diff를 검토한다.

문서 변경만으로 전체 테스트, 전체 린트, 빌드, E2E와 화면 검증을 실행하지 않는다. 사용자가 명시적으로 요청하지 않으면 동일 사실을 여러 명령으로 중복 확인하거나 외부 서비스 smoke test를 추가하지 않는다.

## 8. 완료 조건

- 현재 기준 문서 어디에도 딥링크가 설치 수단으로 남지 않는다.
- CLI가 유일한 설치 수단이며 각 문서의 책임이 중복되지 않는다.
- 설치 명령, 동일 ID의 안전한 교체와 기존 설치 보존 조건이 모든 관련 문서에서 일치한다.
- `development-environment.md`는 개발환경 경계를 넘는 API·보안 세부 계약을 포함하지 않는다.
- 후속 구현자가 문서만으로 웹, 패키지 발행, CLI와 프런트엔드의 변경 범위를 식별할 수 있다.
