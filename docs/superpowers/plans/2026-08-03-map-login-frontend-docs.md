# MapLogin Frontend Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 후속 Codex가 `poc/map-login/`을 기준 구현으로 읽고 실제 제품 프런트엔드의 MapLogin 렌더러를 구현할 수 있도록 `docs/frontend/`에 세 문서로 된 기술 계약을 작성한다.

**Architecture:** `index.md`는 진입점과 읽기 순서를 제공하고, `map-login-renderer.md`는 현재 PoC의 데이터·렌더링 계약을 설명하며, `implementation-guide.md`는 제품 코드로 옮기는 순서와 완료 조건을 제공한다. 모든 사실은 현재 커밋된 `poc/map-login/` 코드에서 확인하며 근사 공식과 제품 미결정 사항을 확정 계약과 분리한다.

**Tech Stack:** Markdown, Node.js CommonJS PoC, Canvas 2D, `@tybys/wz@1.7.1`

## Global Constraints

- 주 독자는 실제 제품 프런트엔드를 구현할 후속 Codex다.
- `poc/map-login/`은 실행 가능한 기준 구현이며 이번 작업에서 수정하지 않는다.
- 코드에서 확인할 수 없는 동작은 확정 사실로 기록하지 않는다.
- 원본 KMS 클라이언트에서 직접 검증하지 않은 공식은 근사 또는 공개 구현 기반이라고 명시한다.
- 저장소 상대 링크를 사용하고 변경에 취약한 코드 줄 번호 링크는 사용하지 않는다.
- 실제 제품 프런트엔드 구현과 WZ 추출기 범용화는 범위 밖이다.

---

### Task 1: 문서 진입점

**Files:**

- Create: `docs/frontend/index.md`
- Reference: `docs/superpowers/specs/2026-08-03-map-login-frontend-docs-design.md`
- Reference: `poc/map-login/README.md`

**Interfaces:**

- Consumes: 승인된 문서화 설계와 PoC README의 범위·실행 계약
- Produces: 후속 Codex가 읽을 문서 순서와 기준 구현 링크

- [ ] **Step 1: 인덱스 본문 작성**

다음 항목을 포함한다.

```markdown
# MapLogin 프런트엔드 구현 문서

## 이 문서를 읽는 대상
## 먼저 읽을 파일
## 문서 지도
## PoC에서 검증된 범위
## 제품 구현 전에 결정할 범위
## 사실 기준
```

`map-login-renderer.md`, `implementation-guide.md`, `../../poc/map-login/README.md`를 상대 링크로 연결한다.

- [ ] **Step 2: 링크 대상 확인**

Run:

```powershell
Test-Path docs\frontend\map-login-renderer.md
Test-Path docs\frontend\implementation-guide.md
Test-Path poc\map-login\README.md
```

Expected: 구현 완료 시 세 결과가 모두 `True`다.

### Task 2: PoC 렌더러 기술 명세

**Files:**

- Create: `docs/frontend/map-login-renderer.md`
- Reference: `poc/map-login/extract.cjs`
- Reference: `poc/map-login/public/app.js`
- Reference: `poc/map-login/public/scene-utils.js`
- Reference: `poc/map-login/public/index.html`
- Reference: `poc/map-login/serve.cjs`

**Interfaces:**

- Consumes: 추출기가 생성하는 `formatVersion: 1` scene manifest와 브라우저 렌더러 계산
- Produces: 데이터 흐름, scene 계약, 렌더링 공식과 한계에 관한 단일 기술 명세

- [ ] **Step 1: 추출 파이프라인과 scene 계약 작성**

다음 실제 필드를 문서화한다.

```text
scene.formatVersion
scene.source
scene.map
scene.backgrounds[]
scene.objects[]
scene.stats
placement.frames[]
```

프레임에는 `asset`, `width`, `height`, `delay`, `origin`, `z`, `a0`, `a1`, `uol`, `inlink`, `outlink`가 포함됨을 기록한다. 배경과 오브젝트의 공통 필드와 배경 전용 `front`, `ani`, `rx`, `ry`, `cx`, `cy`, `type`을 구분한다.

- [ ] **Step 2: 런타임 렌더링 계약 작성**

다음 계산을 현재 함수 이름과 함께 설명한다.

```text
frameAtTime()              누적 delay 기반 프레임 선택
getTileMode()              type 0~7의 반복·이동 축 결정
getBackgroundPosition()    카메라, 패럴랙스, 이동 배경 위치 계산
alphaForFrame()            placement alpha와 a0/a1 보간 결합
resize()                   CSS 배율, 논리 뷰 높이, DPR 계산
render()                   scrollTop을 카메라 좌표로 바꾸고 장면 합성
```

렌더링 순서는 후면 배경 → 정렬된 오브젝트 → 전면 배경으로 기록한다. Canvas는 sticky이고 `scroll-space`가 전체 맵 높이를 제공함을 설명한다.

- [ ] **Step 3: 근사와 한계 작성**

`속도값 × 5 × 경과시간(초)` 공식은 WzComparerR2 MapRender 공개 구현을 따른 것이며 원본 KMS 바이너리에서 직접 검증한 공식이 아님을 명시한다. 실제 로그인 입력 UI, Spine, 파티클, 이동 노드는 PoC 범위 밖임을 기록한다.

### Task 3: 제품 구현 지침

**Files:**

- Create: `docs/frontend/implementation-guide.md`
- Reference: `docs/frontend/map-login-renderer.md`
- Reference: `docs/development-environment.md`
- Reference: `poc/map-login/verify.cjs`

**Interfaces:**

- Consumes: PoC 기술 명세와 제품의 Next.js 16·React 19·TypeScript strict 계약
- Produces: 후속 Codex가 실제 제품 구현에 사용할 순서, 경계와 완료 체크리스트

- [ ] **Step 1: 유지할 계약과 재설계할 경계 작성**

유지할 계약에는 scene 데이터 의미, 좌표계, 프레임 선택, alpha 보간, 배경 type, 레이어 순서와 사용자 직접 스크롤을 포함한다. 재설계할 경계에는 CommonJS 전역, 인라인 CSS, 단일 `app.js`, Node 정적 서버와 생성물 배포 방식을 포함한다.

- [ ] **Step 2: 권장 구현 순서 작성**

다음 순서로 작성한다.

```text
1. scene TypeScript 타입과 런타임 검증 경계
2. 에셋 로더와 오류 상태
3. 순수 장면 계산 모듈
4. Canvas 렌더러
5. 스크롤·리사이즈 UI 경계
6. 추출 생성물의 제품 전달 방식
7. 계산 검증과 브라우저 검증
```

- [ ] **Step 3: 실패 방지와 완료 조건 작성**

자동 카메라 왕복, 첫 프레임 고정, `origin` 누락, CSS 픽셀과 논리 좌표 혼합, 배경 type 6/7 혼동, DPR 누적 transform, 전면 배경 순서 누락을 실패 사례로 포함한다. 완료 조건은 전체 세로 스크롤, 고정 스크롤 위치의 자체 애니메이션, 주요 레이어 순서, 오류 없는 로드와 PoC 계산 테스트 동등성을 포함한다.

### Task 4: 문서 일관성 검증과 커밋

**Files:**

- Verify: `docs/frontend/index.md`
- Verify: `docs/frontend/map-login-renderer.md`
- Verify: `docs/frontend/implementation-guide.md`

**Interfaces:**

- Consumes: Tasks 1~3에서 작성한 세 문서
- Produces: 코드와 일치하고 상호 연결된 커밋 가능한 문서 세트

- [ ] **Step 1: 필수 파일과 PoC 심볼 확인**

Run:

```powershell
Test-Path docs\frontend\index.md
Test-Path docs\frontend\map-login-renderer.md
Test-Path docs\frontend\implementation-guide.md
rg -n "frameAtTime|getTileMode|getBackgroundPosition|alphaForFrame|resize|render" poc\map-login\public
```

Expected: 세 파일이 존재하고 여섯 함수가 현재 PoC에서 검색된다.

- [ ] **Step 2: 미완성과 취약 링크 검사**

Run:

```powershell
rg -n "TBD|TODO|poc/map-login/[^ )]+:[0-9]+" docs\frontend
```

Expected: 출력이 없다.

- [ ] **Step 3: PoC 계산 검증**

Run:

```powershell
npm --prefix poc\map-login run verify
```

Expected: `scene utility verification passed`.

- [ ] **Step 4: 문서 변경 검토**

Run:

```powershell
git diff --check
git status --short
```

Expected: 공백 오류가 없고 `docs/frontend/`의 세 문서만 새 본문 산출물로 표시된다.

- [ ] **Step 5: 문서 커밋**

```powershell
git add -- docs\frontend docs\superpowers\plans\2026-08-03-map-login-frontend-docs.md
git commit -m "docs: MapLogin 프런트엔드 구현 문서를 추가한다"
```
