# MapLogin 제품 구현 가이드

- 상위 문서: [MapLogin 프런트엔드 구현 문서](./index.md)
- 기술 계약: [MapLogin 렌더러 기술 명세](./map-login-renderer.md)
- 기준 구현: [`poc/map-login/`](../../poc/map-login/)
- 제품 환경: [Maple Hatch Pet 개발환경](../development-environment.md)

## 1. 목적

이 문서는 후속 Codex가 MapLogin PoC를 실제 Maple Hatch Pet 프런트엔드로 옮길 때 사용할 실행 순서와 완료 조건이다.

PoC를 그대로 복사하는 것이 목표가 아니다. PoC에서 검증한 WZ 데이터 의미와 장면 계산을 유지하면서 Next.js 16 App Router, React 19, TypeScript strict mode에 맞는 모듈 경계와 사용자 경험으로 다시 구성한다.

## 2. 구현 전에 확인할 것

작업을 시작하기 전에 다음을 확인한다.

1. [프런트엔드 문서 인덱스](./index.md), [렌더러 기술 명세](./map-login-renderer.md), [`poc/map-login/README.md`](../../poc/map-login/README.md)를 읽는다.
2. PoC를 직접 실행해 전체 세로 스크롤과 고정 위치의 애니메이션을 확인한다.
3. 현재 제품 코드 구조와 `docs/development-environment.md`의 기술 계약을 확인한다.
4. [프런트엔드 문서 인덱스의 제품 UI 의도](./index.md#제품-ui-의도)와 현재 제품 명세를 확인한다.
5. v43 추출 결과를 `public/map-login/kms-v43/`에서 제공하는 고정 자산 계약을 확인한다.
6. `MSTitle`, `BtLogin` 4상태와 Notice의 v43 manifest 크기 및 첫 화면 `Title/signboard/0` 장면 좌표를 확인한다.

현재 PoC의 CSS 로그인 폼을 제품 시각 기준으로 복사하지 않는다. 조회 상태와 접근성 흐름만 참고하고, 계정 저장·회원가입·비밀번호 찾기처럼 기능으로 연결되지 않는 컨트롤은 표시하지 않는다.

## 3. 그대로 유지할 계약

제품 구조가 바뀌어도 다음 동작은 PoC와 같아야 한다.

### 데이터 계약

- manifest는 명시적인 `formatVersion`을 가진다.
- 맵 좌표는 `width`, `height`, `centerX`, `centerY`를 사용한다.
- 배경과 오브젝트는 placement와 `frames[]`를 분리한다.
- 각 프레임은 PNG 경로, 크기, `delay`, `origin`, `a0`, `a1`을 제공한다.
- UOL과 링크는 추출 단계에서 해결하고 브라우저에는 결과 PNG 경로를 제공한다.
- 브라우저는 WZ 파일이나 `@tybys/wz`를 직접 파싱하지 않는다.

### 렌더링 계약

- frame delay의 누적 합으로 현재 프레임과 프레임 내부 진행률을 구한다.
- placement alpha와 `a0/a1` 보간값을 곱한다.
- `origin`을 anchor 기준 이미지 오프셋으로 적용한다.
- 수평 flip은 anchor 기준 좌표계를 뒤집은 뒤 origin을 적용한다.
- 배경 type 0~7의 반복 축과 이동 축을 구분한다.
- 오브젝트는 `layer → z → order` 순서로 그린다.
- 합성 순서는 후면 배경 → 오브젝트 → 전면 배경이다.
- 장면을 보여주기 위한 자동 카메라 왕복을 만들지 않는다. 초기 위치 설정 뒤 세로 카메라 전환은 로그인 제출 성공과 `다른 캐릭터 찾기` 활성화로만 시작하고, 휠·터치·스크롤바 직접 이동은 차단한다.
- 스크롤이 멈춰도 `requestAnimationFrame` 애니메이션은 계속 진행한다.

이 계약을 변경하려면 먼저 PoC와 비교 가능한 사례를 만들고 문서와 계산 테스트를 함께 수정한다.

### 제품 UI 계약

- 너비 `1024px` 이상에서만 MapLogin 장면과 생성 UI를 초기화한다. 더 좁은 화면에는 데스크톱 접속 안내를 표시한다.
- 조회 전에는 첫 로그인 화면의 카메라 위치를 고정하고 생성 영역으로의 직접 스크롤을 막는다.
- 로그인 UI는 앱 진입 시 보이는 첫 화면의 `Title/signboard/0` bounds와 현재 카메라 변환에 결합한다. 하단 STR/DEX/INT/LUK 현판과 두 번째 화면에는 배치하지 않는다. `MSTitle`은 버전 자산으로만 유지하고 화면에는 표시하지 않으며, `BtLogin` 4상태와 닉네임 텍스트·선택 영역·커서는 Canvas가 렌더링한다. 화면 밖 native form만 IME·붙여넣기·선택·키보드 제출과 접근성을 담당한다.
- 조회 중에는 진행 문구 없이 `BtLogin/disabled`만 표시해 중복 제출을 막는다. 빈 닉네임과 조회·생성·저장 등 웹 흐름을 막는 오류는 `Login.img/Notice` 기반 공통 경고 다이얼로그로 표시하고, 닫은 뒤 지정된 native 입력 또는 버튼에 스크롤 없이 포커스를 복원한다.
- 공통 경고는 확인 버튼 하나만 제공한다. 확인 또는 `Esc`로 닫고 배경 클릭은 무시하며, 닫은 뒤 호출자가 지정한 입력 또는 실행 버튼으로 포커스를 복원한다.
- 로그인 제출 성공과 `다른 캐릭터 찾기`는 각각 약 1초의 일회성 자동 스크롤을 사용한다. 모션 감소 설정에서는 즉시 이동하며 다른 입력은 카메라 위치에 영향을 주지 않는다.
- 생성 영역은 `NewChar/signboard/0` 좌표를 기준으로 캐릭터와 WZ 양피지를 같은 Canvas에 렌더링한다. 9개 상태는 비순환 좌우 화살표로 이동하고, 현재 액션·표정은 최대 8행의 Canvas 콤보박스로 편집하며, 제품 버튼은 `Basic.img/Tab` 조각으로 합성한다.
- 액션·표정 변경은 왼쪽 캐릭터에 즉시 반영한다. 선택 UI는 [액션·표정 카탈로그 버전 1](../product-spec/action-emotion-catalog.md)의 한국어 표시명만 사용한다.
- 생성 성공 후 같은 Canvas 장면에 NewChar 양피지와 `charAlert` 기반 설치 모달을 열고 `Codex에 설치`, 28일 안내, `spritesheetUrl`이 본문에 포함된 `mailto:1000jjj@naver.com` 삭제 요청 링크와 닫기 버튼을 제공한다. 닫은 뒤에는 편집 화면의 `설치 정보` 버튼으로 다시 연다.
- 생성 후 액션·표정을 바꾸면 생성 결과와 설치 모달을 제거한다. 좌우 화살표로 상태 미리보기만 전환하면 결과를 유지한다.
- 새로고침하거나 화면을 닫으면 생성 결과를 복원하지 않는다. 브라우저 저장소나 결과 재조회 API를 추가하지 않는다.
- 모든 화면에 `Data based on NEXON Open API`와 `/privacy` 링크를 상시 표시한다.

## 4. 제품에서 재설계할 경계

다음은 PoC의 편의를 위한 구현이므로 제품 코드에 그대로 복사하지 않는다.

| PoC 구현 | 제품에서의 방향 |
|---|---|
| CommonJS와 `window.MapLoginScene` 전역 | TypeScript ES module의 명시적 export |
| 하나의 `app.js`에 로드·상태·렌더링 결합 | 데이터 로더, 순수 계산, Canvas 렌더러, React UI 경계 분리 |
| HTML 내부 CSS | 프로젝트 스타일 계약과 컴포넌트 스타일로 이동 |
| Node 내장 정적 서버 | Next.js `public/map-login/kms-v43/` 정적 자산 |
| `public/generated/` 직접 생성 | 명시적으로 추출·검증한 뒤 승인된 버전 자산을 제품 경로에 커밋 |
| 모든 PNG 일괄 선로드 | 현재 MapLogin 규모를 측정한 뒤 로딩 상태와 실패 정책 명시 |
| 오류 stack을 화면에 그대로 표시 | 사용자 메시지와 개발 진단 로그 분리 |
| JSON을 타입 단언만 하고 사용 | `formatVersion`과 필수 필드의 런타임 검증 경계 |

PoC에서 순수 함수로 분리된 계산은 재사용 가치가 높지만 JavaScript 파일 자체를 복사한 뒤 타입만 덧씌우지 않는다. 먼저 계약 테스트를 옮기고 TypeScript 입력·출력 타입을 정의한다.

## 5. 권장 모듈 경계

실제 경로는 구현 시점의 프로젝트 구조에 맞추되 책임은 다음처럼 분리한다.

```text
MapLogin scene types
  └─ manifest의 TypeScript 타입과 formatVersion 검증

MapLogin asset loader
  └─ scene JSON 요청, PNG 선로드, 취소와 실패 변환

MapLogin scene math
  └─ frameAtTime, alpha, tile mode, background position

MapLogin canvas renderer
  └─ 카메라를 받아 후면 배경·오브젝트·전면 배경 합성

MapLogin viewport component
  └─ React client boundary, 스크롤, resize, 상태와 접근성

Notice alert dialog
  └─ notice manifest 로드, plain text 메시지, 모달 포커스와 복귀 대상

MapLogin asset pipeline
  └─ WZ 입력을 제품이 소비할 `public/map-login/kms-v43/` 정적 scene, manifest와 PNG로 변환
```

장면 계산 모듈은 DOM, Canvas와 React에 의존하지 않게 유지한다. 이 경계가 있어야 PoC의 [`verify.cjs`](../../poc/map-login/verify.cjs) 사례를 브라우저 없이 검증할 수 있다.

## 6. 권장 구현 순서

### 1단계: scene 타입과 검증 경계

렌더러보다 먼저 [기술 명세의 `scene.json` 계약](./map-login-renderer.md#4-scenejson-계약)을 TypeScript 타입으로 옮긴다.

최소 확인 항목:

- `formatVersion === 1`
- 맵 크기와 중심 좌표가 유한한 수인지
- 배경·오브젝트에 프레임이 하나 이상 있는지
- 프레임의 asset 경로, 크기, delay와 origin이 유효한지
- 지원하지 않는 formatVersion을 조용히 렌더링하지 않는지

검증 실패는 렌더링 중 예외가 아니라 로딩 실패 상태로 변환한다.

### 2단계: 에셋 로더

scene을 읽고 `backgrounds`와 `objects`의 모든 frame asset 경로를 중복 제거한다. 로드가 끝나기 전, 성공 후, 실패 후 상태를 구분한다.

MVP 로딩 정책은 PoC와 같은 전체 성공이다. 일부 PNG만 누락된 장면을 임의로 계속 그리지 않는다.

React effect가 해제되면 이후 상태 갱신과 animation frame 시작을 막을 수 있도록 취소 경계를 둔다.

### 3단계: 순수 장면 계산

다음 계산을 TypeScript 순수 함수로 옮긴다.

- `frameAtTime`
- `getTileMode`
- `getBackgroundPosition`
- 프레임 alpha 보간

[`verify.cjs`](../../poc/map-login/verify.cjs)의 경계 사례를 제품 테스트 도구인 Vitest로 옮긴다. 특히 frame delay 경계와 type 6의 가로 이동/type 7의 세로 이동을 각각 고정한다.

### 4단계: Canvas 렌더러

Canvas context, scene, 이미지 map, 카메라와 elapsed time을 입력으로 받는 렌더러를 만든다. 렌더러 내부에서 React 상태를 읽지 않는다.

다음 순서를 고정한다.

```text
화면 초기화
→ 후면 배경
→ layer/z/order 정렬 오브젝트
→ 전면 배경
```

매 프레임 `setTransform(deviceScale, 0, 0, deviceScale, 0, 0)`으로 transform을 교체하고 누적하지 않는다.

### 5단계: 스크롤·리사이즈 UI

Canvas와 스크롤 컨테이너는 브라우저 API와 state가 필요하므로 Client Component 경계에 둔다. 페이지 전체를 Client Component로 만들 필요는 없다.

유지할 동작:

- 조회 전 로그인 화면의 스크롤 잠금
- 조회 성공·다른 캐릭터 찾기의 일회성 스크롤 전환
- 로그인·다른 캐릭터 찾기 외 입력으로 카메라가 이동하지 않는 잠금
- 전체 맵 높이에 대응하는 scroll-space
- 현재 화면에 sticky인 Canvas
- `1024px` 이상 컨테이너 너비 기반 scale
- `1024px` 미만에서 장면 대신 표시하는 데스크톱 접속 안내
- DPR 최대 2
- resize 시 bitmap과 CSS 크기 동기화
- unmount 시 animation frame과 event listener 정리

Canvas에는 MapLogin 장면임을 설명하는 접근 가능한 이름을 제공하고 로딩·실패 상태는 텍스트로도 노출한다. 사용자에게 직접 스크롤 가능한 장면이라고 안내하지 않는다.

### 6단계: 버전된 정적 자산 준비

WZ 파일은 브라우저 번들에 포함하지 않는다. `extract.cjs`와 동일한 역할의 도구를 구현 작업 전에 명시적으로 실행해 scene, Notice manifest와 PNG를 만들고 승인된 결과만 `public/map-login/kms-v43/`에 커밋한다. Vercel 빌드 중에는 원본 WZ를 읽거나 자산을 다시 추출하지 않는다. Notice는 `backgrnd/1`과 `BtYes`의 `normal`, `mouseOver`, `pressed`만 추출하고 사용자 메시지는 PNG로 만들지 않는다.

현재 `extract.cjs`는 원본 로그인 패널 전체를 추출하지 않는다. 제품 자산에는 `UI.wz/Login.img/Title/MSTitle`(`397 × 219`)과 `Title/BtLogin`의 `normal`, `mouseOver`, `pressed`, `disabled`(각 `95 × 48`)를 유지한다. 화면 배치는 `MSTitle` 크기가 아니라 현재 scene의 첫 화면 `Title/signboard/0` bounds와 카메라 변환을 기준으로 계산한다.

scene, manifest와 PNG는 같은 버전 경로에서 원자적으로 갱신하고 `formatVersion` 호환성을 확인한다. 이 정적 WZ 자산은 Pet 생성 PNG용 Vercel Blob에 올리지 않는다.

WZ 추출 자산을 비상업 Production에서 공개 제공하는 권리는 별도로 확인되지 않았다. 사용자가 이 위험을 인지하고 MVP 전제로 수용했다는 기록을 유지하며, 이 문장을 법적 허가나 권리 확인으로 해석하지 않는다.

### 7단계: 검증

순수 계산 테스트와 실제 브라우저 검증을 분리한다.

계산 검증:

- frame delay 시작·끝 경계
- 음수 또는 큰 elapsed time의 순환
- type 0, 4, 6, 7 판정
- 대표 카메라에서 이동 배경 좌표
- `a0/a1` 보간과 placement alpha 결합

브라우저 검증:

- manifest와 모든 PNG가 정상 로드됨
- `public/map-login/kms-v43/`의 scene, manifest와 필수 PNG가 같은 버전으로 로드됨
- `new-char.json`의 출처·크기·origin·delay가 KMS v1.2.43 계약과 일치하고 필수 NewChar·Basic PNG가 모두 로드됨
- `MSTitle`은 자산으로 유지되지만 화면에는 표시되지 않고, `BtLogin` 4상태와 Canvas 입력이 첫 로그인 화면의 `Title/signboard/0` 패널에 장면·카메라 좌표로 결합됨
- Notice 배경·버튼이 원본 크기로 로드되고 hover, focus와 active 상태가 각각 맞는 버튼 에셋을 사용함
- 빈 입력과 차단 오류는 Notice로 표시되고, 조회 중은 진행 문구 없이 disabled 버튼으로 중복 제출이 차단됨
- 경고가 확인과 `Esc`로 닫히고 배경 클릭으로 닫히지 않으며 호출자 포커스가 복원됨
- 로그인 화면과 생성 화면 모두 직접 스크롤이 잠김
- 조회 성공 시 약 1초 안에 최상단 생성 영역으로 이동함
- 모션 감소 설정에서는 목적지로 즉시 이동함
- 전환 후에도 휠·터치·스크롤바가 카메라 위치를 바꾸지 않음
- `다른 캐릭터 찾기`가 설정을 초기화하고 로그인 화면으로 돌아감
- 생성 성공 모달에 설치 버튼, 28일 안내와 생성 URL이 이메일 본문에 포함된 삭제 요청 링크가 표시되고 닫은 뒤 `설치 정보`로 다시 열림
- 새로고침 뒤 마지막 생성 결과와 설치 모달이 복원되지 않음
- 모든 화면에 `Data based on NEXON Open API`와 `/privacy` 링크가 표시됨
- 같은 스크롤 위치에서 배경이나 장식이 시간에 따라 변화
- 두 제품 전환 외의 자동 카메라 이동이나 왕복 없음
- 너비 `1024px` 미만에서는 데스크톱 접속 안내만 표시됨
- resize 후 비율과 스크롤 범위 유지
- 콘솔 오류와 error overlay 없음

## 7. 흔한 실패 사례

### 자동 카메라 왕복으로 움직임을 대체함

맵 자체 애니메이션 검증을 카메라 이동으로 대신하지 않는다. 같은 `scrollTop`에서 시간차 화면이 달라야 한다.

### 첫 프레임만 사용함

숫자 프레임 전체와 각각의 delay를 사용한다. 단순 고정 주기나 첫 Canvas만 사용하면 WZ 동작을 잃는다.

### `origin`을 일반 위치로 해석함

placement 좌표는 anchor이고 실제 이미지 왼쪽 위는 `anchor - origin`이다. flip도 같은 anchor 좌표계에서 적용한다.

### CSS 픽셀과 맵 좌표를 혼합함

`scrollTop`은 CSS 픽셀이므로 `scale`로 나눠 맵 좌표로 바꾼다. Canvas bitmap의 `deviceScale`은 별도 값이다.

### type 6과 7을 같은 이동으로 처리함

둘 다 가로·세로 타일링하지만 type 6은 가로 이동, type 7은 세로 이동이다.

### Canvas transform이 누적됨

`scale()`을 반복 호출하지 않고 매 프레임 `setTransform()`으로 현재 DPR을 설정한다.

### 전면 배경을 오브젝트 전에 그림

`front` 배경은 모든 오브젝트 뒤가 아니라 오브젝트 합성 후에 그린다.

### 생성물과 코드를 따로 배포함

새 manifest가 이전 PNG를 참조하거나 이전 manifest가 삭제된 PNG를 참조하지 않도록 scene과 assets를 한 버전으로 배포한다.

## 8. 완료 조건

다음 조건을 모두 만족해야 MapLogin 프런트엔드 구현이 완료된 것으로 본다.

- [ ] 제품 코드가 `formatVersion: 1` scene 계약을 타입과 런타임 경계에서 확인한다.
- [ ] 전체 맵 크기와 center 좌표를 manifest에서 읽고 상수로 복제하지 않는다.
- [ ] 프레임 delay, origin, flip과 alpha 보간이 PoC와 동등하다.
- [ ] 배경 type 0~7의 반복·이동 축이 PoC와 동등하다.
- [ ] 합성 순서가 후면 배경 → 정렬 오브젝트 → 전면 배경이다.
- [ ] 로그인 화면과 생성 화면 모두 직접 스크롤이 잠기고, 초기 설정 외 카메라 전환은 로그인 제출 성공과 `다른 캐릭터 찾기`로만 시작한다.
- [ ] 로그인 제출 성공과 `다른 캐릭터 찾기`의 일회성 전환이 모션 감소 설정을 처리한다.
- [ ] 같은 스크롤 위치에서 WZ 애니메이션 또는 이동 배경이 계속 움직인다.
- [ ] 제품 전환 외의 자동 상하 카메라 왕복이 없다.
- [ ] 너비 `1024px` 미만에서는 MapLogin UI 대신 데스크톱 접속 안내를 표시한다.
- [ ] 생성 영역이 `NewChar/signboard/0` 기준의 캐릭터와 WZ 양피지 Canvas UI로 구성되고 비순환 좌우 화살표로 한 상태씩 편집된다.
- [ ] v43 scene, manifest, `MSTitle`, `BtLogin` 4상태, Notice, NewChar·Basic 자산과 필수 PNG가 `public/map-login/kms-v43/`에서 함께 제공된다.
- [ ] Canvas 로그인 입력과 `BtLogin`이 첫 화면 `Title/signboard/0` 패널의 장면·카메라 좌표를 사용하고, `MSTitle` 또는 화면에 보이는 HTML overlay를 표시하지 않는다.
- [ ] 계정 저장, 회원가입, 비밀번호 찾기 등 비기능 컨트롤을 표시하지 않는다.
- [ ] 생성 성공 후 같은 Canvas 장면의 설치 모달에 `Codex에 설치` 버튼, 28일 안내와 이메일 삭제 요청 링크가 표시되고 `설치 정보`로 다시 열 수 있다.
- [ ] 액션·표정 변경은 기존 생성 결과와 설치 모달을 제거하지만 상태 미리보기 전환은 유지한다.
- [ ] 새로고침 뒤 생성 결과를 복원하지 않는다.
- [ ] 모든 화면에 NEXON 출처 문구와 `/privacy` 링크가 표시된다.
- [ ] 로딩, 성공과 실패 상태가 화면에 구분되어 표시된다.
- [ ] resize와 DPR 변경 뒤에도 비율, 선명도와 스크롤 범위가 유지된다.
- [ ] 순수 계산 테스트가 PoC의 `verify.cjs` 사례를 포함한다.
- [ ] 브라우저에 치명적인 console 오류나 framework error overlay가 없다.
- [ ] WZ 입력과 생성물 전달 방식, 공개 MapRender 기반 근사가 구현 문서에 기록되어 있다.

## 9. 범위 확장 시 문서 갱신

MapLogin 외 맵, Spine, 파티클, 이동 노드 또는 다른 manifest 버전을 지원하면 이 문서를 조용히 일반화하지 않는다. 새 데이터와 렌더링 규칙을 별도 설계로 검증한 뒤 `formatVersion`, 타입, 테스트와 이 문서를 함께 갱신한다.
