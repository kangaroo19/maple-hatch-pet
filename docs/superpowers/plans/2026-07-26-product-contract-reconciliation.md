# Product Contract Reconciliation Implementation Plan

> **보관 상태:** 완료된 역사적 실행 계획이다. 현재 제품 계약과 문서 읽기 순서는 [제품 명세 인덱스](../../product-spec/index.md)를 따른다. 아래 체크박스는 당시 계획 형식을 보존한 것이며 현재 작업 상태를 나타내지 않는다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 확정된 제품 결정 1~10을 기존 제품 문서와 설치 계약에 모순 없이 반영한다.

**Architecture:** `mvp.md`는 사용자에게 보이는 제품 계약을, `pet-generation-flow.md`는 서버 생성 규칙을, 새 `installation-contract.md`는 설치 표면과 로컬 파일 계약을 소유한다. `index.md`는 이 세 문서의 읽기 순서만 연결한다.

**Tech Stack:** Markdown, Codex sprite v1, NEXON Open API 정적 캐릭터 이미지, Codex Pets 딥링크 및 로컬 Pet 계약

## Global Constraints

- 로그인 없는 공개 캐릭터 조회 서비스이며 캐릭터 소유권을 확인하거나 보증하지 않는다.
- 생성 성공마다 추측하기 어려운 새 `petId`를 발급하고 기존 Pet을 갱신하지 않는다.
- HTTP·디코딩 실패 또는 완전히 빈 필수 프레임은 생성을 차단한다.
- NEXON 조회 데이터는 30일 이내에 만료·무효화하고 다음 요청에서 재조회한다.
- 공식 지원 표면은 ChatGPT 데스크톱 앱이다. `npx`는 로컬 Pet 설치 도구로만 지원한다.
- 외부 JSON은 `petId`와 kebab-case 상태 키를 사용한다.

---

### Task 1: 제품 및 생성 계약 정합화

**Files:**
- Modify: `docs/product-spec/mvp.md`
- Modify: `docs/product-spec/pet-generation-flow.md`

**Interfaces:**
- Consumes: 확정된 제품 결정 1~10
- Produces: 사용자 흐름, 생성 요청·응답, 프레임 계획, 정규화·검증 규칙

- [ ] **Step 1: MVP 제품 계약 수정**

소유권 표현, 결정적 Pet ID, 자동 외형 갱신, 미리보기 사전 검증을 제거하고 지원 표면·상태 매핑·표정 0번 프레임·전체 bounds 정규화를 명시한다.

- [ ] **Step 2: 생성 비즈니스 로직 수정**

요청과 응답의 외부 키를 kebab-case와 `petId`로 통일하고, 프레임 대체 금지·빈 프레임 차단·공통 scale 및 anchor 정규화를 단계별 로직과 검증에 반영한다.

- [ ] **Step 3: 두 문서의 핵심 계약 검색**

Run:

```powershell
rg -n "petIdentifier|runningRight|runningLeft|같은 Pet ID|자동 갱신|기본 프레임으로|빈 프레임.*경고|A01\.0.*크롭" docs/product-spec/mvp.md docs/product-spec/pet-generation-flow.md
```

Expected: 제거하기로 한 계약이 검색되지 않는다.

### Task 2: 설치 계약 분리 및 문서 연결

**Files:**
- Create: `docs/product-spec/installation-contract.md`
- Modify: `docs/product-spec/index.md`

**Interfaces:**
- Consumes: `petId`, 생성 결과마다 고유한 HTTPS 스프라이트 자산, Codex 공식 딥링크
- Produces: 데스크톱 딥링크, `npx` 설치, `pet.json`, 설치 실패 처리, 표면별 지원 범위

- [ ] **Step 1: 설치 계약 작성**

딥링크 파라미터, `npx maple-hatch-pet add <pet-id>`, 로컬 `pet.json`, 임시 위치 검증과 설치 실패 처리, 새로고침·선택 절차와 데스크톱·웹·IDE 지원 표를 정의한다.

- [ ] **Step 2: 제품 문서 인덱스 갱신**

`installation-contract.md`를 읽기 순서와 문서 책임 표에 추가한다.

- [ ] **Step 3: 링크와 용어 검증**

Run:

```powershell
rg -n "installation-contract|petId|running-right|ChatGPT 웹|IDE 확장|ChatGPT 데스크톱 앱" docs/product-spec
```

Expected: 새 설치 문서가 인덱스에서 연결되고 외부 계약 이름이 일관된다.

- [ ] **Step 4: 최종 diff 검토**

Run:

```powershell
git diff --check
git diff -- docs/product-spec docs/superpowers/plans/2026-07-26-product-contract-reconciliation.md
```

Expected: 공백 오류가 없고 모든 변경 줄이 확정된 제품 결정에 직접 대응한다.
