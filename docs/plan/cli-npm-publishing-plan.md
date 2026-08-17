# CLI npm 공개 배포 실행계획

- 상태: 계획 확정
- 목적: `cli/`를 `maple-hatch-pet` 공개 npm 패키지로 최초 게시하고, 후속 릴리스를 GitHub Actions와 npm Trusted Publishing으로 자동화한다.
- 선행 계획: [CLI 기반 Codex Pet 설치 흐름 구현계획](./pet-installation-implementation-plan.md)
- 실행 제약: 이 문서를 작성하는 작업에서는 계획서만 추가한다. npm 게시, Production 배포, 패키지·소스 수정, GitHub Actions 추가, 태그 생성과 외부 서비스 설정은 수행하지 않는다.

## 1. 계획서 작성 범위

이번 작업의 변경 대상은 `docs/plan/cli-npm-publishing-plan.md` 하나다. 아래 내용은 후속 배포 작업의 실행 순서와 완료 조건을 정의하며, 이 계획서를 작성하는 시점에는 실행하지 않는다.

- `cli/package.json`과 lockfile 변경
- MIT 라이선스와 CLI README 추가
- Vercel Production 배포와 smoke test
- npm 로그인, 패키지 게시와 게시 결과 확인
- Git 태그 생성과 push
- GitHub Actions workflow와 Environment 설정
- npm Trusted Publisher 설정

## 2. 고정 결정

- npm 패키지와 실행 바이너리 이름은 `maple-hatch-pet`이다.
- 공식 설치 명령은 `npx maple-hatch-pet add <petId>`다.
- 최초 공개 버전은 `0.1.0`이며 후속 버전은 SemVer를 따른다.
- CLI의 Production origin은 `https://maple-hatch-pet.vercel.app`을 유지한다.
- 최초 `0.1.0`은 npm 계정과 2FA를 사용해 로컬에서 수동 게시한다.
- 후속 버전은 GitHub Actions와 npm Trusted Publishing OIDC로 게시하고 장기 `NPM_TOKEN`을 사용하지 않는다.
- 릴리스 태그는 `cli-vX.Y.Z` 형식이다.
- 자동 게시 전 GitHub Environment `npm`에서 `kangaroo19`의 승인을 받는다.
- MIT 라이선스는 저장소 전체에 적용한다.
- Production 다운로드와 실제 CLI 설치 검증을 npm 게시의 필수 선행조건으로 둔다.

## 3. 성공 기준

1. `maple-hatch-pet@0.1.0`이 npm 공개 레지스트리에 게시되고 `latest`가 해당 버전을 가리킨다.
2. 저장소 밖 임시 디렉터리에서 `npx maple-hatch-pet@0.1.0 add <petId>`와 버전을 생략한 공식 명령이 같은 단일 바이너리를 실행한다.
3. 게시 tarball에는 배포에 필요한 manifest, README, LICENSE와 `dist`만 포함되고 소스, 테스트, 로컬 설정과 비밀값은 포함되지 않는다.
4. `cli-vX.Y.Z` 태그와 manifest 버전이 일치할 때만 후속 npm 게시가 실행된다.
5. 후속 게시가 GitHub-hosted runner, OIDC와 GitHub Environment 승인을 통해 수행되고 provenance가 npm에 기록된다.
6. 게시 전에 Production에서 새로 생성한 Pet 패키지를 다운로드하고 CLI로 설치할 수 있다.

## 4. 단계별 실행

### 1단계: 공개 패키지 메타데이터 준비

- `cli/package.json`과 `cli/package-lock.json`의 버전을 `0.1.0`으로 맞춘다.
- manifest에 `license: MIT`, GitHub `repository`와 `directory: cli`, `homepage`, `bugs`와 공개 npm registry용 `publishConfig`를 추가한다.
- `prepack`은 TypeScript를 `dist`로 빌드하고, 수동 게시 전 타입 검사와 CLI 테스트가 반드시 실행되도록 게시 스크립트를 구성한다.
- 루트에 MIT `LICENSE`를 추가해 저장소 전체의 라이선스 범위를 명확히 한다.
- `cli/README.md`에 공식 설치 명령, Node.js 24 요구사항, `add`만 지원한다는 범위, 패키지 만료 시 재생성 안내와 GitHub 문의 경로를 기록한다.
- `files` allowlist와 npm의 기본 포함 파일을 기준으로 실제 tarball 구성을 고정한다.

검증: `npm ci`, CLI 타입 검사, CLI 테스트와 `npm pack --dry-run --json`이 성공하고 예상 파일만 패키지 목록에 포함되는지 확인한다.

### 2단계: Production 게시 게이트

- 웹을 `https://maple-hatch-pet.vercel.app`에 Production 배포한다.
- Production에서 새 Pet을 생성해 유효한 `petId`를 확보한다.
- `GET /api/pets/<petId>/package`가 리다이렉트 없이 `200`과 `application/zip`으로 응답하는지 확인한다.
- `npm pack`으로 만든 tarball을 저장소 밖 임시 디렉터리에 설치하고 해당 `petId`를 사용해 최초 설치를 실행한다.
- 설치된 Pet이 Codex 데스크톱의 Settings > Pets에서 새로고침 후 선택 가능한지 확인한다.
- 어느 검증이든 실패하면 npm 게시로 진행하지 않는다.

검증: Production 다운로드 응답, CLI 종료 코드 `0`, 설치 성공 메시지와 Codex Pets 목록 반영을 한 번 확인한다.

### 3단계: 최초 `0.1.0` 수동 게시

- 게시 직전에 `npm view maple-hatch-pet`으로 이름이 여전히 사용 가능한지 다시 확인한다.
- 깨끗한 `main`의 `cli/`에서 의존성 설치, 타입 검사, 테스트, 빌드와 package dry run을 다시 실행한다.
- npm 로그인 상태와 2FA를 확인하고 `npm publish --access public`으로 게시한다.
- 게시된 패키지의 버전, 라이선스, repository, `latest` dist-tag와 tarball 내용을 확인한다.
- 저장소 밖 임시 디렉터리에서 정확한 버전과 버전 생략 명령을 각각 실행한다.
- 게시한 커밋에 `cli-v0.1.0` 태그를 만들고 원격에 push한다.
- 최초 태그가 자동 게시를 중복 실행하지 않도록 이 태그가 가리키는 커밋에는 게시 workflow를 포함하지 않는다.

검증: `npm view`, 임시 디렉터리의 `npx` 실행과 원격 `cli-v0.1.0` 태그를 확인한다.

### 4단계: 후속 자동 게시 구성

- 최초 게시 완료 후 별도 변경으로 `.github/workflows/publish-cli.yml`을 추가한다.
- workflow는 `cli-v*` 태그 push만 수신하고 태그에서 추출한 버전과 `cli/package.json` 버전이 정확히 일치하는지 먼저 검사한다.
- GitHub-hosted Ubuntu runner와 Node.js 24를 사용하고 `cli/`에서 `npm ci`, 타입 검사, 테스트, 빌드와 package allowlist 검증을 수행한다.
- workflow 권한은 `contents: read`와 `id-token: write`로 제한한다.
- 실제 publish job은 GitHub Environment `npm`을 사용하고 `kangaroo19`를 required reviewer로 설정한다.
- npm 패키지 설정에 GitHub 저장소 `kangaroo19/maple-hatch-pet`, workflow `publish-cli.yml`과 `npm publish` 권한을 Trusted Publisher로 등록한다.
- OIDC가 자동으로 생성하는 provenance를 사용하며 `NPM_TOKEN` secret은 추가하지 않는다.

검증: workflow 구문, 태그·manifest 버전 일치와 불일치 분기, GitHub Environment 승인 대기, npm Trusted Publisher 설정을 확인한다. 실제 OIDC 게시 성공은 다음 SemVer 릴리스에서 검증한다.

### 5단계: 후속 릴리스 절차 고정

1. 변경 성격에 맞는 다음 SemVer를 정한다.
2. `cli/package.json`과 `cli/package-lock.json`의 버전을 같은 값으로 변경한다.
3. CLI 검증과 package dry run을 통과한 변경을 PR로 `main`에 병합한다.
4. 병합 커밋에 `cli-vX.Y.Z` 태그를 생성해 push한다.
5. GitHub Environment `npm`에서 게시를 승인한다.
6. Actions, npm metadata, provenance와 저장소 밖 `npx` 실행을 확인한다.

## 5. 실패 처리

- npm 패키지 이름이 선점됐으면 임의로 scope나 다른 이름을 선택하지 않고 제품 계약 변경 여부를 먼저 결정한다.
- Production 다운로드나 설치 smoke test가 실패하면 원인을 웹 배포 또는 CLI 구현 단계로 돌리고 npm 게시를 중단한다.
- 최초 게시에 실패하면 같은 버전이 실제로 생성됐는지 `npm view`로 확인한 뒤 재시도한다. 이미 게시된 버전은 재사용하지 않는다.
- 태그와 manifest 버전이 다르면 workflow는 게시하지 않고 실패한다.
- 테스트, 타입 검사, 빌드, package allowlist 또는 Environment 승인이 실패하면 publish 단계로 진행하지 않는다.
- OIDC 인증이 실패하면 workflow 파일명, repository metadata, `id-token: write`, runner 종류와 npm Trusted Publisher 설정을 확인한다. 토큰 방식으로 자동 전환하지 않는다.
- 잘못 게시한 버전은 덮어쓰지 않고 필요한 수정 후 새 SemVer로 게시한다.

## 6. 검증 범위

- 변경된 CLI의 타입 검사와 단위 테스트
- `npm pack --dry-run --json` 파일 allowlist 검토
- Production의 새 `petId` 한 건을 사용한 다운로드와 설치 smoke test
- 저장소 밖 임시 디렉터리에서 게시된 정확한 버전과 `latest` 실행
- 태그·manifest 일치 및 불일치 검사
- 다음 실제 릴리스에서 GitHub Environment 승인, OIDC 게시와 provenance 확인

웹 전체 테스트, E2E와 화면 회귀 검증은 Production 게시 게이트에 직접 필요한 범위를 제외하고 반복하지 않는다. npm 게시와 태그 push는 각 단계의 모든 선행 검증이 끝난 뒤에만 수행한다.

## 7. 이번 계획서 작성에서 수행하지 않는 작업

- `cli/package.json`, lockfile, 소스와 테스트 변경
- README와 LICENSE 생성
- Vercel Production 배포와 환경변수 설정
- Pet 생성 또는 다운로드·설치 smoke test
- npm 로그인, 이름 예약, `npm pack`과 `npm publish`
- Git 커밋, 태그 생성과 push
- GitHub Actions workflow와 Environment 생성
- npm Trusted Publisher 등록

이 작업의 완료 조건은 이 실행계획 문서 한 파일이 추가되고, 후속 작업의 결정·순서·검증·중단 조건이 구현자가 추가 결정을 내리지 않아도 될 정도로 명확히 기록되는 것이다.
