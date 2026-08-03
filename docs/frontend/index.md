# MapLogin 프런트엔드 구현 문서

- 상태: PoC 기준 계약
- 기준 구현: [`poc/map-login/`](../../poc/map-login/)
- 기준 PoC 커밋: `40ed1f0`

## 이 문서를 읽는 대상

이 문서 세트는 `poc/map-login/`에서 검증한 MapLogin WZ 장면을 실제 제품 프런트엔드로 옮길 후속 Codex를 위한 구현 계약이다. 사람을 위한 튜토리얼보다 다음 구현에서 유지해야 할 데이터 의미, 렌더링 규칙과 검증 조건을 우선한다.

문서만 읽고 PoC 코드를 생략하면 안 된다. 문서는 결정과 경계를 설명하고 PoC는 실행 가능한 기준 동작을 제공한다.

## 먼저 읽을 파일

다음 순서로 읽는다.

1. 이 문서에서 범위와 사실 기준을 확인한다.
2. [MapLogin 렌더러 기술 명세](./map-login-renderer.md)에서 추출 데이터와 브라우저 렌더링 계약을 확인한다.
3. [제품 구현 가이드](./implementation-guide.md)에서 실제 프로젝트로 옮기는 순서와 완료 조건을 확인한다.
4. [PoC README](../../poc/map-login/README.md)를 읽고 PoC를 실행한다.
5. [`extract.cjs`](../../poc/map-login/extract.cjs), [`scene-utils.js`](../../poc/map-login/public/scene-utils.js), [`app.js`](../../poc/map-login/public/app.js)를 직접 읽는다.

## 문서 지도

| 문서 | 답하는 질문 |
|---|---|
| [MapLogin 렌더러 기술 명세](./map-login-renderer.md) | 현재 PoC는 WZ 장면을 어떤 데이터와 계산으로 복원하는가? |
| [제품 구현 가이드](./implementation-guide.md) | 이 PoC를 실제 Next.js·React 프런트엔드로 어떻게 옮겨야 하는가? |
| [PoC README](../../poc/map-login/README.md) | PoC를 어떻게 추출·실행하며 어떤 한계가 있는가? |

## PoC에서 검증된 범위

현재 PoC는 KMS v1.2.43의 `UI.wz/MapLogin.img`를 대상으로 다음 흐름을 검증했다.

- `@tybys/wz@1.7.1`과 `ZLZ.dll` 키로 `UI.wz`, `Map.wz`를 읽는다.
- `MapLogin.img`에서 전체 맵 크기와 배경·오브젝트 배치를 읽는다.
- `Map.wz/Back/login.img`, `Map.wz/Obj/login.img`에서 실제 Canvas 프레임을 추출한다.
- UOL, `_inlink`, `_outlink`를 따라가고 같은 원본 Canvas를 중복 추출하지 않는다.
- 프레임별 `delay`, `origin`, `a0`, `a1`을 포함한 `scene.json`을 생성한다.
- 브라우저가 개별 PNG와 `scene.json`을 읽어 Canvas에 장면을 합성한다.
- 사용자가 긴 맵을 직접 세로 스크롤하며, 고정된 스크롤 위치에서도 WZ 애니메이션과 이동 배경이 갱신된다.
- 배경의 반복·이동, 프레임 선택과 좌표 계산은 독립된 순수 함수로 가볍게 검증한다.

이 범위는 MapLogin 장면 렌더링 가능성을 증명한다. 범용 메이플스토리 맵 렌더러나 원본 로그인 클라이언트 전체를 증명하지는 않는다.

## 제품 구현 전에 결정할 범위

PoC가 확정하지 않은 다음 항목은 실제 제품 요구사항과 배포 구조에 맞춰 결정해야 한다.

- WZ 추출을 빌드 단계, 별도 도구 또는 관리 파이프라인 중 어디에서 실행할지
- 생성된 PNG와 `scene.json`을 어떤 정적 자산 경로와 캐시 정책으로 배포할지
- Canvas 렌더러를 단일 컴포넌트로 둘지 계산·에셋·스크롤 경계로 나눌지
- 초기 로딩, 일부 에셋 실패, manifest 버전 불일치의 사용자 경험
- 저사양 기기에서 DPR 상한, 프레임 갱신 빈도와 보이는 영역 최적화
- 실제 로그인 폼이나 제품 UI를 MapLogin 장면 위에 어떻게 배치할지
- MapLogin 외 다른 WZ 맵까지 지원할지

이 결정을 문서 없이 암묵적으로 코드에 넣지 않는다.

## 사실 기준

- 현재 커밋된 `poc/map-login/`이 실행 동작의 기준이다.
- `scene.json` 계약은 [`extract.cjs`](../../poc/map-login/extract.cjs)가 실제로 쓰는 필드를 기준으로 한다.
- 렌더링 공식은 [`scene-utils.js`](../../poc/map-login/public/scene-utils.js)와 [`app.js`](../../poc/map-login/public/app.js)를 기준으로 한다.
- 이동 배경의 속도 공식은 공개된 WzComparerR2 MapRender를 참고한 근사다. 원본 KMS 바이너리에서 직접 검증한 공식으로 취급하지 않는다.
- 문서와 코드가 충돌하면 PoC를 실행해 동작을 확인하고 코드와 문서를 같은 변경에서 정렬한다.
- 원본 WZ 파일은 저장소 자산이 아니며 읽기 전용 입력이다.
